import { appDb } from "@/db";
import { db } from "@/config/db";
import { workflows, workflowNodes, workflowEdges, workflowRuns, workflowProcessedAssets } from "@/db/schema/workflows.schema";
import { assets } from "@/schema/assets.schema";
import { exif } from "@/schema";
import { eq, and, desc, gte, isNull, inArray, sql, ne } from "drizzle-orm";
import { buildConditions } from "./conditionBuilder";
import { executeAction } from "./actionExecutor";
import { IUser } from "@/types/user";
import { randomUUID } from "crypto";

async function resolveAssetTrigger(
  subType: string,
  workflowId: string,
  userId: string,
  lookbackMinutes: number = 0,
): Promise<string[]> {
  // Get last successful non-debug run time
  const [lastRun] = await appDb
    .select({ completedAt: workflowRuns.completedAt })
    .from(workflowRuns)
    .where(and(
      eq(workflowRuns.workflowId, workflowId),
      eq(workflowRuns.status, "completed"),
      ne(workflowRuns.trigger, "debug"),
    ))
    .orderBy(desc(workflowRuns.completedAt))
    .limit(1);

  // Fall back to workflow creation time if no previous run
  let sinceDate = lastRun?.completedAt;
  if (!sinceDate) {
    const [wf] = await appDb
      .select({ createdAt: workflows.createdAt })
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);
    sinceDate = wf?.createdAt || new Date();
  }

  // Apply lookback buffer
  if (lookbackMinutes > 0) {
    sinceDate = new Date(sinceDate.getTime() - lookbackMinutes * 60 * 1000);
  }

  const baseConditions = [
    eq(assets.ownerId, userId),
    eq(assets.visibility, "timeline"),
    eq(assets.status, "active"),
    isNull(assets.deletedAt),
  ];

  // Get already-processed assets for this workflow
  let processedMap: Map<string, Date> | null = null;
  if (subType === "new_asset" || subType === "asset_updated") {
    const processed = await appDb
      .select({ assetId: workflowProcessedAssets.assetId, processedAt: workflowProcessedAssets.processedAt })
      .from(workflowProcessedAssets)
      .where(eq(workflowProcessedAssets.workflowId, workflowId));
    processedMap = new Map(processed.map((r) => [r.assetId, r.processedAt || new Date(0)]));
  }

  let candidateIds: string[];

  if (subType === "new_asset") {
    const rows = await db
      .selectDistinctOn([assets.id], { id: assets.id })
      .from(assets)
      .where(and(...baseConditions, gte(assets.createdAt, sinceDate)))
      .limit(10000);
    // For new_asset: skip any asset we've ever processed
    candidateIds = rows.map((r) => r.id).filter((id) => !processedMap?.has(id));
  } else if (subType === "asset_updated") {
    const rows = await db
      .selectDistinctOn([assets.id], { id: assets.id, updatedAt: assets.updatedAt })
      .from(assets)
      .where(and(...baseConditions, gte(assets.updatedAt, sinceDate)))
      .limit(10000);
    // For asset_updated: only skip if we processed it AFTER its current updatedAt
    candidateIds = rows
      .filter((r) => {
        const lastProcessed = processedMap?.get(r.id);
        if (!lastProcessed) return true; // never processed
        return r.updatedAt > lastProcessed; // updated since last processing
      })
      .map((r) => r.id);
  } else {
    // all_assets — no dedup
    const rows = await db
      .selectDistinctOn([assets.id], { id: assets.id })
      .from(assets)
      .where(and(...baseConditions))
      .limit(10000);
    return rows.map((r) => r.id);
  }

  return candidateIds;
}

interface DebugStep {
  nodeId: string;
  nodeType: string;
  subType: string;
  label: string;
  inputAssets: number;
  outputAssets: Record<string, number>;
  assetIds?: string[];
  detail?: string;
}

interface RunResult {
  matchedAssets: number;
  assetIds: string[];
  actions: any[];
  debug?: DebugStep[];
}

export async function executeWorkflow(
  workflowId: string,
  trigger: "manual" | "schedule" | "webhook" | "debug",
  user: IUser
): Promise<string> {
  const isDebug = trigger === "debug";

  // Create run record
  const runId = randomUUID();
  await appDb.insert(workflowRuns).values({
    id: runId,
    workflowId,
    trigger,
    status: "running",
  });

  try {
    // Load graph
    const nodes = await appDb.select().from(workflowNodes).where(eq(workflowNodes.workflowId, workflowId));
    const edges = await appDb.select().from(workflowEdges).where(eq(workflowEdges.workflowId, workflowId));

    // Build adjacency map: nodeId -> { handle -> targetNodeId[] }
    const adjacency = new Map<string, Map<string | null, string[]>>();
    for (const edge of edges) {
      if (!adjacency.has(edge.sourceNodeId)) adjacency.set(edge.sourceNodeId, new Map());
      const handles = adjacency.get(edge.sourceNodeId)!;
      const handle = edge.sourceHandle || null;
      if (!handles.has(handle)) handles.set(handle, []);
      handles.get(handle)!.push(edge.targetNodeId);
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Find asset trigger nodes
    const triggerNodes = nodes.filter((n) => n.type === "trigger");
    if (triggerNodes.length === 0) {
      throw new Error("No asset trigger nodes found in the workflow");
    }

    const result: RunResult = { matchedAssets: 0, assetIds: [], actions: [] };
    const debugSteps: DebugStep[] = [];
    const allProcessedAssetIds = new Set<string>();

    // BFS: process nodes with their incoming asset sets
    const queue: { nodeId: string; assetIds: string[] | null }[] = [];

    // Resolve each asset trigger to get the initial asset set
    for (const triggerNode of triggerNodes) {
      const triggerConfig = JSON.parse(triggerNode.data || "{}");
      const lookback = triggerConfig.lookbackMinutes || 0;
      const assetIds = await resolveAssetTrigger(triggerNode.subType, workflowId, user.id, lookback);
      result.matchedAssets += assetIds.length;

      debugSteps.push({
        nodeId: triggerNode.id,
        nodeType: "trigger",
        subType: triggerNode.subType,
        label: `Asset Trigger: ${triggerNode.subType}`,
        inputAssets: 0,
        outputAssets: { out: assetIds.length },
        assetIds: assetIds.slice(0, 100),
        detail: `Lookback: ${lookback}m, Found ${assetIds.length} assets`,
      });

      const targets = adjacency.get(triggerNode.id)?.get(null) || [];
      for (const targetId of targets) {
        queue.push({ nodeId: targetId, assetIds });
      }
    }

    // Process queue
    while (queue.length > 0) {
      const { nodeId, assetIds } = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const config = JSON.parse(node.data || "{}");

      if (node.type === "logic") {
        if (node.subType === "if") {
          // Query assets matching conditions, scoped to incoming set
          const conditions = config.conditions || [];
          const whereClauses = buildConditions(conditions, user.id);

          // Scope to incoming assets if available
          if (assetIds !== null && assetIds.length > 0) {
            whereClauses.push(inArray(assets.id, assetIds));
          }

          const matchedRows = await db
            .selectDistinctOn([assets.id], { id: assets.id })
            .from(assets)
            .leftJoin(exif, eq(assets.id, exif.assetId))
            .where(and(...whereClauses))
            .limit(10000);

          const matchedIds = matchedRows.map((r) => r.id);
          const matchedSet = new Set(matchedIds);

          let trueIds = matchedIds;
          let falseIds: string[] = [];

          if (assetIds !== null) {
            trueIds = assetIds.filter((id) => matchedSet.has(id));
            falseIds = assetIds.filter((id) => !matchedSet.has(id));
          }

          debugSteps.push({
            nodeId: node.id,
            nodeType: "logic",
            subType: "if",
            label: `IF (${conditions.length} conditions)`,
            inputAssets: assetIds?.length || 0,
            outputAssets: { true: trueIds.length, false: falseIds.length },
            assetIds: trueIds.slice(0, 100),
            detail: `Matched: ${trueIds.length} true, ${falseIds.length} false`,
          });

          // Route to true/false branches
          const trueTargets = adjacency.get(nodeId)?.get("true") || [];
          const falseTargets = adjacency.get(nodeId)?.get("false") || [];
          for (const t of trueTargets) queue.push({ nodeId: t, assetIds: trueIds });
          for (const t of falseTargets) queue.push({ nodeId: t, assetIds: falseIds });

        } else if (node.subType === "switch") {
          const cases = config.cases || [];
          let remaining = assetIds;

          for (const c of cases) {
            const whereClauses = buildConditions(c.conditions || [], user.id);

            // Scope to remaining assets if available
            if (remaining !== null && remaining.length > 0) {
              whereClauses.push(inArray(assets.id, remaining));
            }

            const matchedRows = await db
              .selectDistinctOn([assets.id], { id: assets.id })
              .from(assets)
              .leftJoin(exif, eq(assets.id, exif.assetId))
              .where(and(...whereClauses))
              .limit(10000);

            const matchedIds = matchedRows.map((r) => r.id);
            const matchedSet = new Set(matchedIds);
            let caseIds: string[];

            if (remaining !== null) {
              caseIds = remaining.filter((id) => matchedSet.has(id));
              remaining = remaining.filter((id) => !matchedSet.has(id));
            } else {
              caseIds = matchedIds;
              remaining = [];
            }

            result.matchedAssets = Math.max(result.matchedAssets, caseIds.length);

            const caseTargets = adjacency.get(nodeId)?.get(c.handle) || [];
            for (const t of caseTargets) queue.push({ nodeId: t, assetIds: caseIds });
          }

          const caseOutput: Record<string, number> = {};
          cases.forEach((c: any, i: number) => { caseOutput[c.label || `case_${i}`] = 0; });
          // Already routed above, just log
          debugSteps.push({
            nodeId: node.id,
            nodeType: "logic",
            subType: "switch",
            label: `SWITCH (${cases.length} cases)`,
            inputAssets: assetIds?.length || 0,
            outputAssets: { ...caseOutput, default: (remaining || []).length },
          });

          // Default branch gets remaining
          const defaultTargets = adjacency.get(nodeId)?.get("default") || [];
          for (const t of defaultTargets) queue.push({ nodeId: t, assetIds: remaining || [] });
        }

      } else if (node.type === "action") {
        // Execute action on the asset set
        const actionAssetIds = assetIds || [];
        actionAssetIds.forEach((id) => allProcessedAssetIds.add(id));

        debugSteps.push({
          nodeId: node.id,
          nodeType: "action",
          subType: node.subType,
          label: `Action: ${node.subType}`,
          inputAssets: actionAssetIds.length,
          outputAssets: {},
          assetIds: actionAssetIds.slice(0, 100),
          detail: isDebug ? `DRY RUN — would process ${actionAssetIds.length} assets` : `Processing ${actionAssetIds.length} assets`,
        });

        if (!isDebug && actionAssetIds.length > 0) {
          const actionResult = await executeAction(node.subType, config, actionAssetIds, user);
          result.actions.push({ ...actionResult, assetIds: actionAssetIds });

          // Record processed assets to prevent reprocessing
          if (actionAssetIds.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < actionAssetIds.length; i += batchSize) {
              const batch = actionAssetIds.slice(i, i + batchSize);
              await appDb.insert(workflowProcessedAssets).values(
                batch.map((assetId) => ({
                  workflowId,
                  assetId,
                  runId,
                }))
              );
            }
          }
        }
      }
    }

    // Finalize result
    result.assetIds = Array.from(allProcessedAssetIds);
    result.matchedAssets = result.assetIds.length;
    result.debug = debugSteps;

    // Update run record
    await appDb.update(workflowRuns).set({
      status: "completed",
      result: JSON.stringify(result),
      completedAt: new Date(),
    }).where(eq(workflowRuns.id, runId));

    return runId;

  } catch (error: any) {
    await appDb.update(workflowRuns).set({
      status: "failed",
      error: error.message || "Unknown error",
      completedAt: new Date(),
    }).where(eq(workflowRuns.id, runId));

    throw error;
  }
}

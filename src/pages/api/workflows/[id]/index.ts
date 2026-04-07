import { appDb } from "@/db";
import { workflows, workflowNodes, workflowEdges, workflowRuns } from "@/db/schema/workflows.schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { eq, and, desc } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.query as { id: string };

  if (req.method === "GET") {
    const [workflow] = await appDb
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.ownerId, currentUser.id)));
    if (!workflow) return res.status(404).json({ message: "Workflow not found" });

    const nodes = await appDb.select().from(workflowNodes).where(eq(workflowNodes.workflowId, id));
    const edges = await appDb.select().from(workflowEdges).where(eq(workflowEdges.workflowId, id));
    const [lastRun] = await appDb
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, id))
      .orderBy(desc(workflowRuns.startedAt))
      .limit(1);

    return res.status(200).json({ ...workflow, nodes, edges, lastRun: lastRun || null });
  }

  if (req.method === "PUT") {
    const { name, description, enabled, cronSchedule, viewport } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (enabled !== undefined) updates.enabled = enabled;
    if (cronSchedule !== undefined) updates.cronSchedule = cronSchedule;
    if (viewport !== undefined) updates.viewport = viewport;

    await appDb.update(workflows).set(updates).where(and(eq(workflows.id, id), eq(workflows.ownerId, currentUser.id)));
    const [updated] = await appDb.select().from(workflows).where(eq(workflows.id, id));
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    await appDb.delete(workflows).where(and(eq(workflows.id, id), eq(workflows.ownerId, currentUser.id)));
    return res.status(204).end();
  }

  return res.status(405).json({ message: "Method not allowed" });
}

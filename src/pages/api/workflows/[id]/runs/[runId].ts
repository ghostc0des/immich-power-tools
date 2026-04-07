import { appDb } from "@/db";
import { workflows, workflowNodes, workflowEdges, workflowRuns } from "@/db/schema/workflows.schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { eq, and } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  const { id, runId } = req.query as { id: string; runId: string };

  // Verify ownership
  const [workflow] = await appDb
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.ownerId, currentUser.id)));
  if (!workflow) return res.status(404).json({ message: "Workflow not found" });

  const [run] = await appDb
    .select()
    .from(workflowRuns)
    .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.workflowId, id)));
  if (!run) return res.status(404).json({ message: "Run not found" });

  const nodes = await appDb.select().from(workflowNodes).where(eq(workflowNodes.workflowId, id));
  const edges = await appDb.select().from(workflowEdges).where(eq(workflowEdges.workflowId, id));

  return res.status(200).json({
    run,
    workflow: { ...workflow, nodes, edges },
  });
}

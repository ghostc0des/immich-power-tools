import { appDb } from "@/db";
import { workflows, workflowNodes, workflowEdges } from "@/db/schema/workflows.schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { eq, and } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.query as { id: string };

  const [workflow] = await appDb
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.ownerId, currentUser.id)));
  if (!workflow) return res.status(404).json({ message: "Workflow not found" });

  const nodes = await appDb.select().from(workflowNodes).where(eq(workflowNodes.workflowId, id));
  const edges = await appDb.select().from(workflowEdges).where(eq(workflowEdges.workflowId, id));

  const exportData = {
    version: 1,
    name: workflow.name,
    description: workflow.description,
    viewport: workflow.viewport,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      subType: n.subType,
      data: n.data,
      positionX: n.positionX,
      positionY: n.positionY,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      sourceHandle: e.sourceHandle,
    })),
  };

  return res.status(200).json(exportData);
}

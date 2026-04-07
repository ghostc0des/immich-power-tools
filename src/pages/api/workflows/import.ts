import { appDb } from "@/db";
import { workflows, workflowNodes, workflowEdges } from "@/db/schema/workflows.schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { eq } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  const { name, description, viewport, nodes, edges } = req.body;

  if (!nodes || !Array.isArray(nodes)) {
    return res.status(400).json({ message: "Invalid workflow format: nodes array required" });
  }

  const workflowId = randomUUID();
  const webhookToken = randomUUID();

  // Create ID mapping for imported nodes
  const idMap = new Map<string, string>();
  for (const node of nodes) {
    idMap.set(node.id, randomUUID());
  }

  await appDb.insert(workflows).values({
    id: workflowId,
    ownerId: currentUser.id,
    name: name || "Imported Workflow",
    description: description || null,
    viewport: viewport || '{"x":0,"y":0,"zoom":1}',
    webhookToken,
    enabled: false,
  });

  if (nodes.length > 0) {
    await appDb.insert(workflowNodes).values(
      nodes.map((n: any) => ({
        id: idMap.get(n.id) || randomUUID(),
        workflowId,
        type: n.type,
        subType: n.subType,
        data: typeof n.data === "string" ? n.data : JSON.stringify(n.data || {}),
        positionX: n.positionX || 0,
        positionY: n.positionY || 0,
      }))
    );
  }

  if (edges && edges.length > 0) {
    await appDb.insert(workflowEdges).values(
      edges.map((e: any) => ({
        id: randomUUID(),
        workflowId,
        sourceNodeId: idMap.get(e.sourceNodeId) || e.sourceNodeId,
        targetNodeId: idMap.get(e.targetNodeId) || e.targetNodeId,
        sourceHandle: e.sourceHandle || null,
      }))
    );
  }

  const [created] = await appDb.select().from(workflows).where(eq(workflows.id, workflowId));
  return res.status(201).json(created);
}

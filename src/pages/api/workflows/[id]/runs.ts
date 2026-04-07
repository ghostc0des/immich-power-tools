import { appDb } from "@/db";
import { workflowRuns, workflows } from "@/db/schema/workflows.schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { eq, and, desc } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.query as { id: string };

  // Verify ownership
  const [workflow] = await appDb
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.ownerId, currentUser.id)));
  if (!workflow) return res.status(404).json({ message: "Workflow not found" });

  const runs = await appDb
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflowId, id))
    .orderBy(desc(workflowRuns.startedAt))
    .limit(20);

  return res.status(200).json(runs);
}

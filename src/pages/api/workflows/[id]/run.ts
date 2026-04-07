import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { executeWorkflow } from "@/lib/workflow/engine";
import { appDb } from "@/db";
import { workflowRuns } from "@/db/schema/workflows.schema";
import { eq } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.query as { id: string };

  const { mode } = req.body || {};
  const trigger = mode === "debug" ? "debug" : "manual";

  try {
    const runId = await executeWorkflow(id, trigger as any, currentUser);
    const [run] = await appDb.select().from(workflowRuns).where(eq(workflowRuns.id, runId));
    return res.status(200).json(run);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Workflow execution failed" });
  }
}

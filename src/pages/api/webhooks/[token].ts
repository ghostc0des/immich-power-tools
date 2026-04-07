import { appDb } from "@/db";
import { workflows } from "@/db/schema/workflows.schema";
import { eq } from "drizzle-orm";
import { executeWorkflow } from "@/lib/workflow/engine";
import { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/config/db";
import { users } from "@/schema/users.schema";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { token } = req.query as { token: string };

  const [workflow] = await appDb
    .select()
    .from(workflows)
    .where(eq(workflows.webhookToken, token));

  if (!workflow) return res.status(404).json({ message: "Webhook not found" });

  if (!workflow.enabled) return res.status(422).json({ message: "Workflow is disabled" });

  // Get user from Immich DB
  const [user] = await db.select().from(users).where(eq(users.id, workflow.ownerId));
  if (!user) return res.status(404).json({ message: "Owner not found" });

  try {
    const runId = await executeWorkflow(workflow.id, "webhook", user as any);
    return res.status(200).json({ runId });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Workflow execution failed" });
  }
}

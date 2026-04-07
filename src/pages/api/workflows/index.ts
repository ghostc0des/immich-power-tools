import { appDb } from "@/db";
import { workflows } from "@/db/schema/workflows.schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { eq, desc } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  if (req.method === "GET") {
    const rows = await appDb
      .select()
      .from(workflows)
      .where(eq(workflows.ownerId, currentUser.id))
      .orderBy(desc(workflows.updatedAt));
    return res.status(200).json(rows);
  }

  if (req.method === "POST") {
    const { name, description } = req.body;
    const id = randomUUID();
    const webhookToken = randomUUID();
    await appDb.insert(workflows).values({
      id,
      ownerId: currentUser.id,
      name: name || "Untitled Workflow",
      description: description || null,
      webhookToken,
    });
    const [row] = await appDb.select().from(workflows).where(eq(workflows.id, id));
    return res.status(201).json(row);
  }

  return res.status(405).json({ message: "Method not allowed" });
}

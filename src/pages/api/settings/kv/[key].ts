import { appDb } from "@/db";
import { settings } from "@/db/schema/settings.schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { eq, and } from "drizzle-orm";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  const { key } = req.query as { key: string };

  if (req.method === "GET") {
    const [row] = await appDb
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.ownerId, currentUser.id)));
    if (!row) return res.status(404).json({ message: "Setting not found" });
    return res.status(200).json(row);
  }

  if (req.method === "PUT") {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ message: "value is required" });

    const [existing] = await appDb
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.ownerId, currentUser.id)));

    if (existing) {
      await appDb.update(settings).set({ value }).where(eq(settings.id, existing.id));
    } else {
      await appDb.insert(settings).values({ key, value, ownerId: currentUser.id });
    }

    const [row] = await appDb
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.ownerId, currentUser.id)));
    return res.status(200).json(row);
  }

  if (req.method === "DELETE") {
    await appDb.delete(settings).where(and(eq(settings.key, key), eq(settings.ownerId, currentUser.id)));
    return res.status(204).end();
  }

  return res.status(405).json({ message: "Method not allowed" });
}

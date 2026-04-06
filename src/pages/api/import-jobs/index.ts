import type { NextApiRequest, NextApiResponse } from "next";
import { desc, eq } from "drizzle-orm";
import { appDb } from "@/db";
import { importJobs, importJobItems } from "@/db/schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { getUserHeaders } from "@/helpers/user.helper";
import { runImportJob } from "@/workers/import/runner";
import { getProcessor } from "@/workers/import/registry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

    const jobs = await appDb
      .select()
      .from(importJobs)
      .where(eq(importJobs.userId, currentUser.id))
      .orderBy(desc(importJobs.createdAt))
      .limit(20);

    return res.status(200).json({ jobs });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const { platform, url, urlConfig, importData, assets } = req.body;

  if (!platform || !url || !Array.isArray(assets) || assets.length === 0) {
    return res.status(400).json({ error: "platform, url, and assets are required" });
  }

  if (assets.some((a: unknown) => typeof (a as any).id !== "string")) {
    return res.status(400).json({ error: "Each asset must have a string id" });
  }

  try {
    getProcessor(platform);
  } catch {
    return res.status(400).json({ error: `Unknown platform: ${platform}` });
  }

  const [job] = await appDb
    .insert(importJobs)
    .values({
      userId: currentUser.id,
      platform,
      url,
      urlConfig: JSON.stringify(urlConfig ?? {}),
      importData: JSON.stringify(importData ?? {}),
      totalCount: assets.length,
    })
    .returning();

  await appDb.insert(importJobItems).values(
    assets.map((asset: { id: string; [key: string]: unknown }) => ({
      jobId: job.id,
      assetId: asset.id,
      itemData: JSON.stringify(asset),
    }))
  );

  const headers = getUserHeaders(currentUser) as Record<string, string>;
  runImportJob(job.id, headers).catch((err) =>
    console.error("Unhandled error in runImportJob", err)
  );

  return res.status(201).json({ jobId: job.id });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { appDb } from "@/db";
import { importJobs, importJobItems } from "@/db/schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { getUserHeaders } from "@/helpers/user.helper";
import { runImportJob } from "@/workers/import/runner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const { platform, url, urlConfig, importData, assets } = req.body;

  if (!platform || !url || !Array.isArray(assets) || assets.length === 0) {
    return res.status(400).json({ error: "platform, url, and assets are required" });
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

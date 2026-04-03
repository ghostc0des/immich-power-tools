import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { appDb } from "@/db";
import { importJobs, importJobItems } from "@/db/schema";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { getUserHeaders } from "@/helpers/user.helper";
import { isJobActive, runImportJob } from "@/workers/import/runner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

  const { jobId } = req.query as { jobId: string };

  const [job] = await appDb.select().from(importJobs).where(eq(importJobs.id, jobId));
  if (!job || job.userId !== currentUser.id) {
    return res.status(404).json({ error: "Job not found" });
  }

  if (job.status === "pending" && !isJobActive(jobId)) {
    const headers = getUserHeaders(currentUser) as Record<string, string>;
    runImportJob(jobId, headers).catch((err) =>
      console.error("Unhandled error in runImportJob (resume)", err)
    );
  }

  const items = await appDb
    .select()
    .from(importJobItems)
    .where(eq(importJobItems.jobId, jobId));

  return res.status(200).json({ job, items });
}

import { eq, inArray, sql } from "drizzle-orm";
import { appDb } from "@/db";
import { importJobs, importJobItems } from "@/db/schema";
import { getProcessor } from "./registry";
import "./processors/index"; // side-effect: registers all processors

export type { ImportJob, ImportJobItem } from "./types";

const activeJobs = new Set<string>();
const CONCURRENCY = 4;

export function isJobActive(jobId: string) {
  return activeJobs.has(jobId);
}

export async function getJobItems(jobId: string) {
  return appDb
    .select()
    .from(importJobItems)
    .where(eq(importJobItems.jobId, jobId));
}

export async function resumePendingJobs() {
  await appDb
    .update(importJobs)
    .set({ status: "pending" })
    .where(eq(importJobs.status, "processing"));
}

export async function runImportJob(
  jobId: string,
  headers: Record<string, string>
): Promise<void> {
  if (activeJobs.has(jobId)) return;
  activeJobs.add(jobId);

  try {
    const [job] = await appDb
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, jobId));
    if (!job || job.status === "completed" || job.status === "failed") return;

    await appDb
      .update(importJobs)
      .set({ status: "processing" })
      .where(eq(importJobs.id, jobId));

    const processor = getProcessor(job.platform);
    const context = { headers };

    // Setup: dedup + album creation
    const { skipAssetIds, albumId, importDataPatch } = await processor.setup(
      job,
      context
    );

    if (importDataPatch) {
      const merged = { ...JSON.parse(job.importData), ...importDataPatch };
      await appDb
        .update(importJobs)
        .set({ importData: JSON.stringify(merged) })
        .where(eq(importJobs.id, jobId));
    }

    if (skipAssetIds.length > 0) {
      await appDb
        .update(importJobItems)
        .set({ status: "skipped" })
        .where(inArray(importJobItems.assetId, skipAssetIds));
      await appDb
        .update(importJobs)
        .set({ skippedCount: skipAssetIds.length })
        .where(eq(importJobs.id, jobId));
    }

    // Fetch only the items that are still pending for this job (after skip updates)
    const pending = await appDb
      .select()
      .from(importJobItems)
      .where(eq(importJobItems.jobId, jobId))
      .then((rows) => rows.filter((r) => r.status === "pending"));

    const processorContext = { ...context, albumId };

    let currentIndex = 0;
    const worker = async () => {
      while (true) {
        const index = currentIndex++;
        if (index >= pending.length) break;
        const item = pending[index];

        await appDb
          .update(importJobItems)
          .set({ status: "processing" })
          .where(eq(importJobItems.id, item.id));

        try {
          const { immichId } = await processor.processItem(
            job,
            item,
            processorContext
          );
          await appDb
            .update(importJobItems)
            .set({ status: "uploaded", immichId })
            .where(eq(importJobItems.id, item.id));
          await appDb
            .update(importJobs)
            .set({ uploadedCount: sql`${importJobs.uploadedCount} + 1` })
            .where(eq(importJobs.id, jobId));
        } catch (err: any) {
          await appDb
            .update(importJobItems)
            .set({ status: "failed", error: err?.message ?? "Unknown error" })
            .where(eq(importJobItems.id, item.id));
          await appDb
            .update(importJobs)
            .set({ failedCount: sql`${importJobs.failedCount} + 1` })
            .where(eq(importJobs.id, jobId));
        }
      }
    };

    const concurrency = Math.min(CONCURRENCY, pending.length);
    if (concurrency > 0) {
      await Promise.all(Array.from({ length: concurrency }, worker));
    }

    await appDb
      .update(importJobs)
      .set({ status: "completed" })
      .where(eq(importJobs.id, jobId));
  } catch (err: any) {
    console.error(`Import job ${jobId} failed fatally:`, err);
    await appDb
      .update(importJobs)
      .set({ status: "failed" })
      .where(eq(importJobs.id, jobId));
  } finally {
    activeJobs.delete(jobId);
  }
}

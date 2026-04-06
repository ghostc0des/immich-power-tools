import type { importJobs, importJobItems } from "@/db/schema";

export type ImportJob = typeof importJobs.$inferSelect;
export type ImportJobItem = typeof importJobItems.$inferSelect;

export interface ProcessorContext {
  headers: Record<string, string>;  // user auth headers for Immich API calls
  albumId?: string;                  // resolved after setup()
}

export interface SetupResult {
  skipAssetIds: string[];            // source asset IDs already in Immich → mark skipped
  albumId?: string;                  // created or resolved album ID
  importDataPatch?: Record<string, unknown>; // merged into job.importData in db
}

export interface ImportProcessor {
  /** Called once per job before items are processed. Dedup + album creation. */
  setup(job: ImportJob, context: ProcessorContext): Promise<SetupResult>;
  /** Called once per item. Returns the Immich asset ID on success, throws on failure. */
  processItem(job: ImportJob, item: ImportJobItem, context: ProcessorContext): Promise<{ immichId: string }>;
}

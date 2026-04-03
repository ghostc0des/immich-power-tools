import { IMPORT_JOBS_PATH, IMPORT_JOB_PATH } from "@/config/routes";
import API from "@/lib/api";

export interface CreateImportJobParams {
  platform: string;
  url: string;
  urlConfig: Record<string, unknown>;
  importData: Record<string, unknown>;
  assets: { id: string; [key: string]: unknown }[];
}

export const createImportJob = async (params: CreateImportJobParams): Promise<{ jobId: string }> => {
  return API.post(IMPORT_JOBS_PATH, params);
};

export interface ImportJobStatus {
  job: {
    id: string;
    status: string;
    platform: string;
    totalCount: number;
    uploadedCount: number;
    skippedCount: number;
    failedCount: number;
    importData: string;
  };
  items: {
    id: string;
    assetId: string;
    status: string;
    immichId: string | null;
    error: string | null;
  }[];
}

export const getImportJob = async (jobId: string): Promise<ImportJobStatus> => {
  return API.get(IMPORT_JOB_PATH(jobId));
};

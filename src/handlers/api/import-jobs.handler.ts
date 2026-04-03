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

export const getImportJob = async (jobId: string) => {
  return API.get(IMPORT_JOB_PATH(jobId));
};

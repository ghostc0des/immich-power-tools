import { IMPORT_SHARED_PATH } from "@/config/routes";
import API from "@/lib/api";

export const importShared = async (link: string, password?: string) => {
  return API.post(IMPORT_SHARED_PATH, { link, password: password || undefined });
};

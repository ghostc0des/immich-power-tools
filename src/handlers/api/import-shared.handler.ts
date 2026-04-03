import { IMPORT_SHARED_PATH, IMPORT_SHARED_UPLOAD_ALL_PATH } from "@/config/routes";
import API from "@/lib/api";

export const importShared = async (link: string) => {
  return API.post(IMPORT_SHARED_PATH, { link });
};

export const importSharedUploadAll = async (params: {
  origin: string;
  key: string;
  assets: object[];
  albumOptions: object;
}) => {
  return API.post(IMPORT_SHARED_UPLOAD_ALL_PATH, params);
};

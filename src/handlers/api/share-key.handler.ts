import { SHARE_KEY_PATH } from "@/config/routes";
import API from "@/lib/api";

export const getShareKey = async () => {
  return API.get(SHARE_KEY_PATH);
};

export const createShareKey = async () => {
  return API.post(SHARE_KEY_PATH);
};

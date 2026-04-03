import { SETTINGS_API_KEYS_PATH, SETTINGS_API_KEY_PATH } from "@/config/routes";
import API from "@/lib/api";

export const getApiKeys = async () => {
  return API.get(SETTINGS_API_KEYS_PATH);
};

export const deleteApiKey = async (purpose: string) => {
  return API.delete(SETTINGS_API_KEY_PATH(purpose));
};

export const regenerateApiKey = async (purpose: string) => {
  return API.put(SETTINGS_API_KEY_PATH(purpose));
};

import { VALIDATE_PERMISSIONS_PATH } from "@/config/routes";
import API from "@/lib/api";

export interface PermissionsResult {
  canUpload: boolean;
}

export const validatePermissions = async (): Promise<PermissionsResult> => {
  return API.get(VALIDATE_PERMISSIONS_PATH);
};

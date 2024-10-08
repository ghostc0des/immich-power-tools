import {
  ADD_ASSETS_ALBUMS_PATH,
  LIST_ALBUMS_PATH,
  LIST_MISSING_LOCATION_ASSETS_PATH,
  LIST_MISSING_LOCATION_DATES_PATH,
} from "@/config/routes";
import { cleanUpAsset } from "@/helpers/asset.helper";
import API from "@/lib/api";
import { IAsset } from "@/types/asset";

interface IMissingAssetAlbumsFilters {
  startDate?: string;
  endDate?: string;
}
export interface IMissingLocationDatesResponse {
  date: string;
  asset_count: number;
}

export const listMissingLocationDates = async (
  filters: IMissingAssetAlbumsFilters
): Promise<IMissingLocationDatesResponse[]> => {
  return API.get(LIST_MISSING_LOCATION_DATES_PATH, filters);
};

export const listMissingLocationAssets = async (
  filters: IMissingAssetAlbumsFilters
): Promise<IAsset[]> => {
  return API.get(LIST_MISSING_LOCATION_ASSETS_PATH, filters).then((assets) =>
    assets.map(cleanUpAsset)
  );
};

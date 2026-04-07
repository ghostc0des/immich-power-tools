import { eq } from "drizzle-orm";
import { appDb } from "@/db";
import { importJobItems } from "@/db/schema";
import { ENV } from "@/config/environment";
import {
  ensurePowerToolsTag,
  HeadersRecord,
} from "@/pages/api/import-shared/helpers";
import type { ImportJob, ImportJobItem, ImportProcessor, ProcessorContext, SetupResult } from "../types";

const DEVICE_ID = "immich-power-tools";
const makeDeviceAssetId = (assetId: string) => `shared-${assetId}`;

interface ISharedAssetPayload {
  id: string;
  originalFileName?: string;
  type: string;
  fileCreatedAt?: string | null;
  localDateTime?: string | null;
  duration?: string | null;
  isFavorite?: boolean;
  isArchived?: boolean;
}

interface DownloadedAssetPayload {
  buffer: Buffer;
  fileName: string;
  contentType: string | null;
}

const inferAssetTypeFromName = (fileName: string): "IMAGE" | "VIDEO" => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return "IMAGE";
  switch (extension) {
    case "mp4":
    case "mov":
    case "m4v":
    case "avi":
    case "mkv":
    case "webm":
    case "3gp":
    case "3g2":
    case "mts":
    case "m2ts":
      return "VIDEO";
    default:
      return "IMAGE";
  }
};

const parseFileNameFromDisposition = (disposition?: string | null): string | null => {
  if (!disposition) return null;
  const match = disposition.match(/filename\*?=([^;]+)/i);
  if (!match || !match[1]) return null;
  const value = match[1].trim().replace(/^UTF-8''/i, "").replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const guessContentType = (fileName: string): string => {
  const extension = fileName.toLowerCase().split(".").pop();
  switch (extension) {
    case "jpg":
    case "jpeg":
    case "jfif":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "tif":
    case "tiff":
      return "image/tiff";
    case "bmp":
      return "image/bmp";
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "avi":
      return "video/x-msvideo";
    case "mkv":
      return "video/x-matroska";
    case "webm":
      return "video/webm";
    case "3gp":
    case "3g2":
      return "video/3gpp";
    case "mts":
    case "m2ts":
      return "video/MP2T";
    default:
      return "application/octet-stream";
  }
};

const createImmichAlbum = async (albumName: string, headers: HeadersRecord): Promise<string> => {
  const response = await fetch(`${ENV.IMMICH_URL}/api/albums`, {
    method: "POST",
    headers,
    body: JSON.stringify({ albumName }),
  });
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(`Your API key does not have permission to create albums. Try importing without creating an album, or use an API key with album.create permission.`);
    }
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to create album "${albumName}" (status ${response.status}): ${body || "Unknown error"}`);
  }
  const album = await response.json().catch(() => null);
  const albumId = album?.id;
  if (!albumId || typeof albumId !== "string") {
    throw new Error("Immich album creation response did not include an id");
  }
  return albumId;
};

const addAssetToAlbum = async (albumId: string, assetId: string, headers: HeadersRecord): Promise<void> => {
  const response = await fetch(`${ENV.IMMICH_URL}/api/albums/${albumId}/assets`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ ids: [assetId] }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to attach asset ${assetId} to album ${albumId} (status ${response.status}): ${body || "Unknown error"}`
    );
  }
};

const downloadSharedAsset = async (
  asset: ISharedAssetPayload,
  origin: string,
  key: string
): Promise<DownloadedAssetPayload> => {
  const url = `${origin}/api/assets/${asset.id}/original?key=${key}`;
  const response = await fetch(url, { method: "GET", headers: { accept: "*/*" } });
  if (!response.ok) {
    throw new Error(`Failed to download ${asset.originalFileName ?? asset.id} (status ${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const disposition = response.headers.get("content-disposition");
  const inferredName = parseFileNameFromDisposition(disposition);
  const fallbackExtension = asset.type === "VIDEO" ? "mp4" : "jpg";
  const fileName = inferredName ?? asset.originalFileName ?? `${asset.id}.${fallbackExtension}`;
  return { buffer, fileName, contentType: response.headers.get("content-type") };
};

const uploadAssetBuffer = async (
  asset: ISharedAssetPayload,
  payload: DownloadedAssetPayload,
  uploadHeaders: HeadersRecord,
  jsonHeaders: HeadersRecord,
  tagId?: string
): Promise<string> => {
  const fileType = asset.type ?? inferAssetTypeFromName(payload.fileName);
  const resolvedFileName = payload.fileName || asset.originalFileName || `${asset.id}.bin`;
  const contentType = payload.contentType ?? guessContentType(resolvedFileName);
  const uint8Array = new Uint8Array(payload.buffer.byteLength);
  uint8Array.set(payload.buffer);
  const blob = new Blob([uint8Array.buffer], { type: contentType });
  const createdAt = asset.fileCreatedAt ?? asset.localDateTime ?? new Date().toISOString();
  const modifiedAt = asset.localDateTime ?? asset.fileCreatedAt ?? createdAt;

  const formData = new FormData();
  formData.set("deviceAssetId", makeDeviceAssetId(asset.id));
  formData.set("deviceId", DEVICE_ID);
  formData.set("fileCreatedAt", createdAt);
  formData.set("fileModifiedAt", modifiedAt);
  formData.set("fileType", fileType);
  formData.set("duration", asset.duration ?? "0:00:00.000000");
  formData.set("assetData", blob, resolvedFileName);
  if (asset.isArchived) formData.set("isArchived", String(asset.isArchived));
  if (asset.isFavorite) formData.set("isFavorite", String(asset.isFavorite));

  const uploadResponse = await fetch(`${ENV.IMMICH_URL}/api/assets`, {
    method: "POST",
    headers: uploadHeaders,
    body: formData,
  });

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text().catch(() => "");
    throw new Error(
      `Upload failed for ${asset.originalFileName ?? asset.id} (status ${uploadResponse.status}): ${body || "Unknown error"}`
    );
  }

  const uploaded = await uploadResponse.json();
  const uploadedId = uploaded?.id;
  if (!uploadedId) {
    throw new Error("Immich upload response did not include an asset id");
  }

  if (tagId) {
    const { tagAssetWithPowerTools } = await import("@/pages/api/import-shared/helpers");
    await tagAssetWithPowerTools(tagId, uploadedId, jsonHeaders);
  }
  return uploadedId;
};

export class ImmichSharedLinkProcessor implements ImportProcessor {
  async setup(job: ImportJob, context: ProcessorContext): Promise<SetupResult> {
    const headers = context.headers as HeadersRecord;

    // Load all items for this job from the db
    const items = await appDb
      .select()
      .from(importJobItems)
      .where(eq(importJobItems.jobId, job.id));

    // Build deviceAssetIds for dedup check
    const deviceAssetIds: string[] = [];
    const deviceAssetIdLookup = new Map<string, string>();
    for (const item of items) {
      const deviceAssetId = makeDeviceAssetId(item.assetId);
      deviceAssetIds.push(deviceAssetId);
      deviceAssetIdLookup.set(deviceAssetId.toLowerCase(), item.assetId);
    }

    // Check which assets already exist in Immich
    const skipAssetIds: string[] = [];
    if (deviceAssetIds.length > 0) {
      try {
        const jsonHeadersWithContentType: HeadersRecord = {
          ...headers,
          "Content-Type": "application/json",
        };
        const checkResponse = await fetch(`${ENV.IMMICH_URL}/api/assets/exist`, {
          method: "POST",
          headers: jsonHeadersWithContentType,
          body: JSON.stringify({ deviceAssetIds, deviceId: DEVICE_ID }),
        });

        if (checkResponse.ok) {
          const existPayload = await checkResponse.json().catch(() => ({}));
          const existingIds: string[] = existPayload?.existingIds ?? [];
          for (const deviceAssetId of existingIds) {
            if (typeof deviceAssetId !== "string") continue;
            const matchedAssetId = deviceAssetIdLookup.get(deviceAssetId.toLowerCase());
            if (matchedAssetId) {
              skipAssetIds.push(matchedAssetId);
            }
          }
        } else {
          console.warn(`[ImmichSharedLinkProcessor] Failed to check existing assets (status ${checkResponse.status})`);
        }
      } catch (error) {
        console.warn("[ImmichSharedLinkProcessor] Unable to check existing assets", error);
      }
    }

    // Parse importData for album options
    let importData: Record<string, unknown> = {};
    try {
      importData = JSON.parse(job.importData);
    } catch {
      // ignore parse errors, treat as empty
    }

    const albumOptions = importData.albumOptions as {
      createAlbum?: boolean;
      albumName?: string;
      addToAlbumId?: string;
    } | undefined;

    let albumId: string | undefined;
    const jsonHeadersWithContentType: HeadersRecord = {
      ...headers,
      "Content-Type": "application/json",
    };

    if (albumOptions?.createAlbum) {
      const desiredAlbumName =
        albumOptions.albumName?.trim() || `Shared import ${new Date().toISOString()}`;
      albumId = await createImmichAlbum(desiredAlbumName, jsonHeadersWithContentType);
      console.log(`[ImmichSharedLinkProcessor] Created album ${albumId} (${desiredAlbumName})`);
    } else if (typeof albumOptions?.addToAlbumId === "string" && albumOptions.addToAlbumId.trim()) {
      albumId = albumOptions.addToAlbumId.trim();
    }

    const importDataPatch: Record<string, unknown> = {};
    if (albumId) importDataPatch.albumId = albumId;

    // Tag assets with "immich-power-tools" if enabled
    const tagAssets = importData.tagAssets !== false; // default true for backwards compat
    if (tagAssets) {
      try {
        const tag = await ensurePowerToolsTag({ ...context.headers, "Content-Type": "application/json" } as HeadersRecord);
        importDataPatch.tagId = tag.id;
      } catch (err) {
        console.warn("[ImmichSharedLinkProcessor] Failed to create power-tools tag, skipping tagging", err);
      }
    }

    return { skipAssetIds, albumId, importDataPatch };
  }

  async processItem(
    job: ImportJob,
    item: ImportJobItem,
    context: ProcessorContext
  ): Promise<{ immichId: string }> {
    const headers = context.headers as HeadersRecord;

    // Parse item metadata
    let asset: ISharedAssetPayload;
    try {
      const parsed = JSON.parse(item.itemData);
      asset = {
        id: item.assetId,
        originalFileName: parsed.originalFileName,
        type: parsed.type ?? "IMAGE",
        fileCreatedAt: parsed.fileCreatedAt ?? null,
        localDateTime: parsed.localDateTime ?? null,
        duration: parsed.duration ?? null,
        isFavorite: parsed.isFavorite ?? false,
        isArchived: parsed.isArchived ?? false,
      };
    } catch {
      asset = { id: item.assetId, type: "IMAGE" };
    }

    // Parse urlConfig for the share key
    let urlConfig: Record<string, unknown> = {};
    try {
      urlConfig = JSON.parse(job.urlConfig);
    } catch {
      // ignore
    }
    const key = typeof urlConfig.key === "string" ? urlConfig.key : "";

    // Download the asset from the shared link
    const downloaded = await downloadSharedAsset(asset, job.url, key);

    // Strip Content-Type for multipart upload (same pattern as upload-all.ts)
    const { ["Content-Type"]: _omit, ...uploadHeaders } = headers;

    // Read tagId from importData set during setup() (optional)
    const importData = JSON.parse(job.importData) as { albumId?: string; tagId?: string };
    const tagId = importData.tagId;

    const immichId = await uploadAssetBuffer(asset, downloaded, uploadHeaders as HeadersRecord, headers as HeadersRecord, tagId);

    // Add to album if one was resolved during setup
    if (context.albumId) {
      const jsonHeadersWithContentType: HeadersRecord = {
        ...headers,
        "Content-Type": "application/json",
      };
      await addAssetToAlbum(context.albumId, immichId, jsonHeadersWithContentType);
    }

    return { immichId };
  }
}

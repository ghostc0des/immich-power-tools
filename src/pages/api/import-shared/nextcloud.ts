import { XMLParser } from "fast-xml-parser";
import { inferAssetTypeFromName } from "./helpers";

const NEXTCLOUD_SHARE_PATTERN =
  /^(https?:\/\/[^/]+?)(?:\/index\.php)?\/s\/([a-zA-Z0-9]{10,32})\/?$/;

export interface NextcloudDetection {
  baseUrl: string;
  token: string;
}

export interface NextcloudShareMetadata {
  displayName: string | null;
  ownerId: string | null;
  totalSize: number;
}

export interface NextcloudFileEntry {
  relativePath: string;
  fileName: string;
  contentType: string | null;
  size: number;
  lastModified: string | null;
  type: "IMAGE" | "VIDEO";
  blurhash: string | null;
  fileId: string | null;
}

export interface NextcloudListResult {
  metadata: NextcloudShareMetadata;
  files: NextcloudFileEntry[];
}

/**
 * Detect if a URL is a Nextcloud public share link.
 * Returns { baseUrl, token } or null.
 */
export const detectNextcloud = (url: string): NextcloudDetection | null => {
  const match = url.trim().match(NEXTCLOUD_SHARE_PATTERN);
  if (!match) return null;
  return { baseUrl: match[1], token: match[2] };
};

const buildBasicAuth = (username: string, password: string): string => {
  const encoded = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${encoded}`;
};

const PROPFIND_BODY = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <d:getlastmodified/>
    <oc:fileid/>
    <oc:owner-id/>
    <oc:size/>
    <nc:metadata-blurhash/>
  </d:prop>
</d:propfind>`;

/**
 * Check if a Nextcloud share is password-protected.
 * Returns true if password is required.
 */
export const checkPasswordProtection = async (
  baseUrl: string,
  token: string
): Promise<boolean> => {
  const webdavUrl = `${baseUrl}/public.php/dav/files/${token}/`;
  const response = await fetch(webdavUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: buildBasicAuth(token, ""),
      Depth: "0",
      "Content-Type": "application/xml",
    },
    body: "<d:propfind xmlns:d='DAV:'><d:prop/></d:propfind>",
  });

  if (response.status === 207) return false;
  if (response.status === 401) return true;

  throw new Error(
    `Unexpected response from Nextcloud (status ${response.status})`
  );
};

const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "jfif", "png", "heic", "heif", "webp",
  "gif", "tif", "tiff", "bmp", "svg", "avif", "jxl",
  "cr2", "nef", "arw", "dng", "raf", "orf", "rw2",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4", "mov", "m4v", "avi", "mkv", "webm",
  "3gp", "3g2", "mts", "m2ts",
]);

const isMediaFile = (fileName: string): boolean => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext);
};

/**
 * List all files in a Nextcloud public share, flattened (no directories).
 * Only returns image and video files. Also extracts share-level metadata.
 */
export const listNextcloudFiles = async (
  baseUrl: string,
  token: string,
  password: string = ""
): Promise<NextcloudListResult> => {
  const webdavUrl = `${baseUrl}/public.php/dav/files/${token}/`;
  const response = await fetch(webdavUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: buildBasicAuth(token, password),
      Depth: "infinity",
      "Content-Type": "application/xml",
    },
    body: PROPFIND_BODY,
  });

  if (response.status === 401) {
    throw Object.assign(new Error("PASSWORD_REQUIRED"), { code: "PASSWORD_REQUIRED" });
  }

  if (!response.ok && response.status !== 207) {
    throw new Error(`Failed to list Nextcloud share (status ${response.status})`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });
  const parsed = parser.parse(xml);

  const multistatus = parsed.multistatus;
  if (!multistatus) {
    throw new Error("Invalid PROPFIND response from Nextcloud");
  }

  // Normalize responses to array
  let responses = multistatus.response;
  if (!Array.isArray(responses)) {
    responses = responses ? [responses] : [];
  }

  const prefix = `/public.php/dav/files/${token}/`;
  const files: NextcloudFileEntry[] = [];
  const metadata: NextcloudShareMetadata = {
    displayName: null,
    ownerId: null,
    totalSize: 0,
  };

  for (const resp of responses) {
    const href = typeof resp.href === "string" ? decodeURIComponent(resp.href) : "";
    // Get the first propstat with 200 status (skip 404 propstats)
    const propstats = Array.isArray(resp.propstat) ? resp.propstat : [resp.propstat];
    const okPropstat = propstats.find(
      (ps: any) => ps?.status?.includes("200") ?? false
    ) ?? propstats[0];
    const prop = okPropstat?.prop;
    if (!prop) continue;

    // Check if it's a directory (collection)
    const resourceType = prop.resourcetype;
    const isCollection =
      resourceType != null &&
      typeof resourceType === "object" &&
      "collection" in resourceType;

    // Extract relative path
    const prefixIdx = href.indexOf(prefix);
    const relativePath =
      prefixIdx >= 0 ? href.slice(prefixIdx + prefix.length) : href;

    // Root collection — extract share metadata
    if (isCollection && !relativePath) {
      metadata.displayName =
        typeof prop.displayname === "string" ? prop.displayname : null;
      metadata.ownerId =
        typeof prop["owner-id"] === "string" ? prop["owner-id"] : null;
      const totalSize =
        typeof prop.size === "number"
          ? prop.size
          : parseInt(prop.size || "0", 10) || 0;
      metadata.totalSize = totalSize;
      continue;
    }

    if (isCollection) continue; // skip subdirectories
    if (!relativePath) continue;

    const fileName = relativePath.split("/").pop() || relativePath;

    // Filter to media files only
    if (!isMediaFile(fileName)) continue;

    const contentType =
      typeof prop.getcontenttype === "string" ? prop.getcontenttype : null;
    const size =
      typeof prop.getcontentlength === "number"
        ? prop.getcontentlength
        : parseInt(prop.getcontentlength || "0", 10) || 0;
    // Convert RFC 2822 date to ISO 8601 (Immich requires ISO format for fileCreatedAt)
    const rawLastModified =
      typeof prop.getlastmodified === "string" ? prop.getlastmodified : null;
    let lastModified: string | null = null;
    if (rawLastModified) {
      const parsed = new Date(rawLastModified);
      lastModified = Number.isNaN(parsed.getTime()) ? rawLastModified : parsed.toISOString();
    }
    const blurhash =
      typeof prop["metadata-blurhash"] === "string"
        ? prop["metadata-blurhash"]
        : null;
    const fileId =
      prop.fileid != null ? String(prop.fileid) : null;

    files.push({
      relativePath,
      fileName,
      contentType,
      size,
      lastModified,
      type: inferAssetTypeFromName(fileName),
      blurhash,
      fileId,
    });
  }

  return { metadata, files };
};

/**
 * Build a Nextcloud public preview URL for a shared file.
 */
export const buildNextcloudPreviewUrl = (
  baseUrl: string,
  token: string,
  relativePath: string,
  width: number,
  height: number
): string => {
  const params = new URLSearchParams({
    file: `/${relativePath}`,
    x: String(width),
    y: String(height),
    mimeFallback: "true",
    a: "0",
  });
  return `${baseUrl}/apps/files_sharing/publicpreview/${token}?${params.toString()}`;
};

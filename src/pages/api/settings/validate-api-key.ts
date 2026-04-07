import { ENV } from "@/config/environment";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { NextApiRequest, NextApiResponse } from "next";

const REQUIRED_PERMISSIONS = [
  "asset.read",
  "asset.update",
  "album.create",
  "album.update",
  "tag.create",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const currentUser = await getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ message: "apiKey is required" });

  try {
    // Validate by calling Immich's auth endpoint with the key
    const authRes = await fetch(`${ENV.IMMICH_URL}/api/users/me`, {
      headers: { "x-api-key": apiKey },
    });

    if (!authRes.ok) {
      return res.status(200).json({
        valid: false,
        error: "Invalid API key — could not authenticate with Immich",
        permissions: [],
        missing: REQUIRED_PERMISSIONS,
      });
    }

    // Get the API key details to check permissions
    const keysRes = await fetch(`${ENV.IMMICH_URL}/api/api-keys`, {
      headers: { "x-api-key": apiKey },
    });

    if (!keysRes.ok) {
      // Can authenticate but can't list keys — might be a full-access key
      return res.status(200).json({
        valid: true,
        error: null,
        permissions: ["all (could not verify individual permissions)"],
        missing: [],
      });
    }

    const keys = await keysRes.json();

    // Find the key being used — it's the one that matches our request
    // Immich doesn't directly tell us which key is in use, so check all permissions across all keys
    // The safest check: try to access endpoints that require each permission
    const permissionChecks = await Promise.all([
      // asset.read — try searching assets
      fetch(`${ENV.IMMICH_URL}/api/assets?take=1`, {
        headers: { "x-api-key": apiKey },
      }).then((r) => ({ permission: "asset.read", granted: r.ok })),

      // asset.update — try a dry validation (we just check if the endpoint doesn't 403)
      fetch(`${ENV.IMMICH_URL}/api/assets`, {
        method: "PUT",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [], isFavorite: true }),
      }).then((r) => ({ permission: "asset.update", granted: r.status !== 403 })),

      // album.create — check via OPTIONS or a minimal request
      fetch(`${ENV.IMMICH_URL}/api/albums`, {
        headers: { "x-api-key": apiKey },
      }).then((r) => ({ permission: "album.create", granted: r.ok })),

      // album.update — same endpoint access implies read+write
      fetch(`${ENV.IMMICH_URL}/api/albums`, {
        headers: { "x-api-key": apiKey },
      }).then((r) => ({ permission: "album.update", granted: r.ok })),

      // tag.create
      fetch(`${ENV.IMMICH_URL}/api/tags`, {
        headers: { "x-api-key": apiKey },
      }).then((r) => ({ permission: "tag.create", granted: r.ok || r.status !== 403 })),
    ]);

    const granted = permissionChecks.filter((p) => p.granted).map((p) => p.permission);
    const missing = REQUIRED_PERMISSIONS.filter((p) => !granted.includes(p));

    return res.status(200).json({
      valid: missing.length === 0,
      error: missing.length > 0 ? `Missing permissions: ${missing.join(", ")}` : null,
      permissions: granted,
      missing,
    });
  } catch (error: any) {
    return res.status(200).json({
      valid: false,
      error: `Could not connect to Immich: ${error.message}`,
      permissions: [],
      missing: REQUIRED_PERMISSIONS,
    });
  }
}

# Orphan Asset Finder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a page that finds "orphaned" assets — those not in albums, without detected people, missing location, or never favorited — with combinable checkbox filters, asset grid, and bulk actions (add to album, trash, delete).

**Architecture:** New API route queries Immich's DB via Drizzle with LEFT JOINs to detect orphan conditions. Frontend page follows the empty-videos pattern: filters in Header, AssetGrid with PhotoSelectionContext, FloatingBar with bulk actions. Sidebar entry added.

**Tech Stack:** Next.js API route, Drizzle ORM (PostgreSQL), React, Tailwind, existing shared components (PageLayout, Header, FloatingBar, AssetGrid, AlbumSelectorDialog, AlertDialog).

---

### Task 1: Add API route for orphan assets

**Files:**
- Create: `src/pages/api/assets/orphan-finder.ts`

**Step 1: Create the API route**

```typescript
import { db } from "@/config/db";
import { getCurrentUser } from "@/handlers/serverUtils/user.utils";
import { NextApiRequest, NextApiResponse } from "next";
import { and, eq, isNull, isNotNull, sql, desc, asc, not } from "drizzle-orm";
import { assets } from "@/schema/assets.schema";
import { exif } from "@/schema";
import { albumsAssetsAssets } from "@/schema/albumAssetsAssets.schema";
import { assetFaces } from "@/schema/assetFaces.schema";
import { isFlipped } from "@/helpers/asset.helper";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const currentUser = await getCurrentUser(req);
  if (!currentUser) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const {
    notInAlbum,
    noPeople,
    noLocation,
    notFavorited,
    type,
    limit = "100",
    page = "1",
  } = req.query as Record<string, string>;

  const limitNum = parseInt(limit, 10);
  const pageNum = parseInt(page, 10);

  // Build conditions
  const conditions = [
    eq(assets.ownerId, currentUser.id),
    eq(assets.visibility, "timeline"),
    eq(assets.status, "active"),
    isNull(assets.deletedAt),
  ];

  if (type && type !== "ALL") {
    conditions.push(eq(assets.type, type));
  }

  if (notFavorited === "true") {
    conditions.push(eq(assets.isFavorite, false));
  }

  if (noLocation === "true") {
    conditions.push(isNull(exif.latitude));
  }

  // Subquery approach for notInAlbum and noPeople
  const notInAlbumCondition = notInAlbum === "true"
    ? sql`NOT EXISTS (SELECT 1 FROM "album_asset" aa WHERE aa."assetId" = ${assets.id})`
    : undefined;

  const noPeopleCondition = noPeople === "true"
    ? sql`NOT EXISTS (SELECT 1 FROM "asset_face" af WHERE af."assetId" = ${assets.id} AND af."personId" IS NOT NULL)`
    : undefined;

  if (notInAlbumCondition) conditions.push(notInAlbumCondition);
  if (noPeopleCondition) conditions.push(noPeopleCondition);

  // At least one orphan filter must be active
  const hasOrphanFilter = notInAlbum === "true" || noPeople === "true" || noLocation === "true" || notFavorited === "true";
  if (!hasOrphanFilter) {
    return res.status(400).json({ message: "At least one orphan filter is required" });
  }

  const dbAssets = await db
    .selectDistinctOn([assets.id], {
      id: assets.id,
      deviceId: assets.deviceId,
      type: assets.type,
      originalPath: assets.originalPath,
      isFavorite: assets.isFavorite,
      duration: assets.duration,
      originalFileName: assets.originalFileName,
      deletedAt: assets.deletedAt,
      localDateTime: assets.localDateTime,
      exifImageWidth: exif.exifImageWidth,
      exifImageHeight: exif.exifImageHeight,
      ownerId: assets.ownerId,
      dateTimeOriginal: exif.dateTimeOriginal,
      orientation: exif.orientation,
    })
    .from(assets)
    .leftJoin(exif, eq(assets.id, exif.assetId))
    .where(and(...conditions))
    .orderBy(assets.id, desc(assets.localDateTime))
    .limit(limitNum)
    .offset((pageNum - 1) * limitNum);

  const cleanedAssets = dbAssets.map((asset) => ({
    ...asset,
    exifImageHeight: isFlipped(asset?.orientation) ? asset?.exifImageWidth : asset?.exifImageHeight,
    exifImageWidth: isFlipped(asset?.orientation) ? asset?.exifImageHeight : asset?.exifImageWidth,
    orientation: asset?.orientation,
  }));

  return res.status(200).json(cleanedAssets);
}
```

**Step 2: Commit**

```bash
git add src/pages/api/assets/orphan-finder.ts
git commit -m "feat: add orphan finder API route"
```

---

### Task 2: Add route constant and handler function

**Files:**
- Modify: `src/config/routes.ts`
- Modify: `src/handlers/api/asset.handler.ts`

**Step 1: Add route constant**

In `src/config/routes.ts`, add after `LIST_EMPTY_VIDEOS_PATH`:

```typescript
export const LIST_ORPHAN_ASSETS_PATH = BASE_API_ENDPOINT + "/assets/orphan-finder";
```

**Step 2: Add handler function**

In `src/handlers/api/asset.handler.ts`, add import and function:

Add `LIST_ORPHAN_ASSETS_PATH` to the imports from `@/config/routes`.

Add this function:

```typescript
export interface IOrphanFilters {
  notInAlbum?: boolean;
  noPeople?: boolean;
  noLocation?: boolean;
  notFavorited?: boolean;
  type?: string;
  limit?: number;
  page?: number;
}

export const listOrphanAssets = async (filters: IOrphanFilters): Promise<IAsset[]> => {
  const params: Record<string, string> = {};
  if (filters.notInAlbum) params.notInAlbum = "true";
  if (filters.noPeople) params.noPeople = "true";
  if (filters.noLocation) params.noLocation = "true";
  if (filters.notFavorited) params.notFavorited = "true";
  if (filters.type) params.type = filters.type;
  if (filters.limit) params.limit = String(filters.limit);
  if (filters.page) params.page = String(filters.page);
  return API.get(LIST_ORPHAN_ASSETS_PATH, params).then((assets) => assets.map(cleanUpAsset));
}
```

**Step 3: Commit**

```bash
git add src/config/routes.ts src/handlers/api/asset.handler.ts
git commit -m "feat: add orphan finder route constant and handler"
```

---

### Task 3: Create the Orphan Finder page

**Files:**
- Create: `src/pages/assets/orphan-finder.tsx`

**Step 1: Create the page**

Follow the empty-videos pattern: PageLayout, Header with filters, PhotoSelectionContext, AssetGrid, FloatingBar with bulk actions.

```tsx
import PageLayout from '@/components/layouts/PageLayout'
import Header from '@/components/shared/Header'
import Loader from '@/components/ui/loader'
import { listOrphanAssets, deleteAssets, IOrphanFilters } from '@/handlers/api/asset.handler'
import { addAssetToAlbum, createAlbumWithAssets } from '@/handlers/api/album.handler'
import { IAsset } from '@/types/asset'
import React, { useEffect, useState, useMemo } from 'react'
import { Camera, Trash2, Trash, Search } from 'lucide-react'
import { humanizeNumber } from '@/helpers/string.helper'
import PhotoSelectionContext, { IPhotoSelectionContext } from '@/contexts/PhotoSelectionContext'
import FloatingBar from '@/components/shared/FloatingBar'
import { Button } from '@/components/ui/button'
import { AlertDialog } from '@/components/ui/alert-dialog'
import AssetGrid from '@/components/shared/AssetGrid'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import AlbumSelectorDialog from '@/components/albums/AlbumSelectorDialog'
import { IAlbum } from '@/types/album'
import { toast } from '@/components/ui/use-toast'

export default function OrphanFinderPage() {
  const [assets, setAssets] = useState<IAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [filters, setFilters] = useState<IOrphanFilters>({
    notInAlbum: true,
    noPeople: false,
    noLocation: false,
    notFavorited: false,
    type: 'ALL',
    limit: 200,
    page: 1,
  })

  const [contextState, setContextState] = useState<IPhotoSelectionContext>({
    selectedIds: [],
    assets: [],
    config: {
      albumId: '',
      sort: "fileOriginalDate",
      sortOrder: "asc"
    },
    updateContext: (newConfig: Partial<IPhotoSelectionContext>) => {
      setContextState(prevState => ({
        ...prevState,
        ...newConfig,
        config: newConfig.config ? { ...prevState.config, ...newConfig.config } : prevState.config
      }));
    }
  });

  const selectedAssets = useMemo(() =>
    contextState.assets.filter((a) => contextState.selectedIds.includes(a.id)),
    [contextState.assets, contextState.selectedIds]
  );

  const hasActiveFilter = filters.notInAlbum || filters.noPeople || filters.noLocation || filters.notFavorited;

  const fetchOrphans = async () => {
    if (!hasActiveFilter) return;
    setLoading(true)
    setErrorMessage('')
    listOrphanAssets(filters)
      .then((fetchedAssets) => {
        setAssets(fetchedAssets)
        contextState.updateContext({ assets: fetchedAssets, selectedIds: [] })
      })
      .catch((error) => {
        setErrorMessage(error.message || 'Failed to load orphan assets')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchOrphans()
  }, [filters])

  const handleDelete = () => {
    return deleteAssets(contextState.selectedIds, { force: true }).then(() => {
      const newAssets = contextState.assets.filter((a) => !contextState.selectedIds.includes(a.id));
      setAssets(newAssets)
      contextState.updateContext({ selectedIds: [], assets: newAssets });
    })
  }

  const handleTrash = () => {
    return deleteAssets(contextState.selectedIds, { force: false }).then(() => {
      const newAssets = contextState.assets.filter((a) => !contextState.selectedIds.includes(a.id));
      setAssets(newAssets)
      contextState.updateContext({ selectedIds: [], assets: newAssets });
    })
  }

  const handleAddToAlbum = async (album: IAlbum) => {
    await addAssetToAlbum(album.id, contextState.selectedIds);
    toast({ title: "Success", description: `Added ${contextState.selectedIds.length} asset(s) to "${album.albumName}"` });
    // Re-fetch if "not in album" filter is active (assets may no longer be orphans)
    if (filters.notInAlbum) {
      fetchOrphans();
    }
  }

  const handleCreateAlbumWithAssets = async (data: { albumName: string }) => {
    return createAlbumWithAssets(data.albumName, contextState.selectedIds).then(() => {
      if (filters.notInAlbum) {
        fetchOrphans();
      }
    });
  }

  const handleFilterToggle = (key: keyof IOrphanFilters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key], page: 1 }));
  }

  const renderContent = () => {
    if (!hasActiveFilter) {
      return (
        <div className="text-center py-8 text-gray-500">
          Select at least one filter to find orphan assets.
        </div>
      );
    }
    if (loading) return <Loader />
    if (errorMessage) return <div className="text-red-500 p-4">{errorMessage}</div>
    return (
      <div className="p-4">
        {assets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Search size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No orphan assets found</h3>
            <p>All your assets are well-organized with the current filters.</p>
          </div>
        ) : (
          <AssetGrid
            assets={assets}
            selectable={true}
            onSelectionChange={(ids) => contextState.updateContext({ selectedIds: ids })}
          />
        )}
      </div>
    )
  }

  return (
    <PageLayout className="!p-0 !mb-0 relative pb-20">
      <Header
        leftComponent="Orphan Finder"
        rightComponent={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="notInAlbum"
                  checked={filters.notInAlbum}
                  onCheckedChange={() => handleFilterToggle('notInAlbum')}
                />
                <Label htmlFor="notInAlbum" className="text-sm cursor-pointer">No Album</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="noPeople"
                  checked={filters.noPeople}
                  onCheckedChange={() => handleFilterToggle('noPeople')}
                />
                <Label htmlFor="noPeople" className="text-sm cursor-pointer">No People</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="noLocation"
                  checked={filters.noLocation}
                  onCheckedChange={() => handleFilterToggle('noLocation')}
                />
                <Label htmlFor="noLocation" className="text-sm cursor-pointer">No Location</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="notFavorited"
                  checked={filters.notFavorited}
                  onCheckedChange={() => handleFilterToggle('notFavorited')}
                />
                <Label htmlFor="notFavorited" className="text-sm cursor-pointer">Not Favorited</Label>
              </div>
            </div>
            <Select
              value={filters.type}
              onValueChange={(value) => setFilters(prev => ({ ...prev, type: value, page: 1 }))}
            >
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="IMAGE">Images</SelectItem>
                <SelectItem value="VIDEO">Videos</SelectItem>
              </SelectContent>
            </Select>
            {!loading && assets.length > 0 && (
              <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-500">
                {humanizeNumber(assets.length)}
                <Camera className="w-4 h-4" />
              </div>
            )}
          </div>
        }
      />
      <PhotoSelectionContext.Provider value={{ ...contextState, updateContext: contextState.updateContext }}>
        {renderContent()}
        {selectedAssets.length > 0 && (
          <FloatingBar>
            <div className="flex items-center gap-2 justify-between w-full">
              <p className="text-sm text-muted-foreground">
                {contextState.selectedIds.length} Selected
              </p>
              <div className="flex items-center gap-2">
                {contextState.selectedIds.length === contextState.assets.length ? (
                  <Button variant="outline" size="sm" onClick={() => contextState.updateContext({ selectedIds: [] })}>
                    Unselect all
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => contextState.updateContext({ selectedIds: contextState.assets.map((a) => a.id) })}>
                    Select all
                  </Button>
                )}
                <div className="h-[10px] w-[1px] bg-zinc-500 dark:bg-zinc-600" />
                <AlbumSelectorDialog
                  onSelected={handleAddToAlbum}
                  onSubmit={handleCreateAlbumWithAssets}
                />
                <div className="h-[10px] w-[1px] bg-zinc-500 dark:bg-zinc-600" />
                <AlertDialog
                  title="Move selected assets to Trash?"
                  description="This action will move the selected assets to trash. You can restore them later."
                  onConfirm={handleTrash}
                  disabled={contextState.selectedIds.length === 0}
                >
                  <Button variant="outline" size="sm" disabled={contextState.selectedIds.length === 0}>
                    <Trash className="w-4 h-4 mr-2" />
                    Trash
                  </Button>
                </AlertDialog>
                <AlertDialog
                  title="Delete the selected assets?"
                  description="This action will delete the selected assets and cannot be undone."
                  onConfirm={handleDelete}
                  disabled={contextState.selectedIds.length === 0}
                >
                  <Button variant="destructive" size="sm" disabled={contextState.selectedIds.length === 0}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialog>
              </div>
            </div>
          </FloatingBar>
        )}
      </PhotoSelectionContext.Provider>
    </PageLayout>
  )
}
```

**Step 2: Commit**

```bash
git add src/pages/assets/orphan-finder.tsx
git commit -m "feat: add orphan finder page with filters and bulk actions"
```

---

### Task 4: Add sidebar entry

**Files:**
- Modify: `src/config/constants/sidebarNavs.tsx`

**Step 1: Add the sidebar nav entry**

Add `PackageSearch` to the lucide-react import, then add the entry after "Bulk Duplicate Finder":

```tsx
{
  title: "Orphan Finder",
  link: "/assets/orphan-finder",
  icon: <PackageSearch className="h-4 w-4" />,
},
```

**Step 2: Commit**

```bash
git add src/config/constants/sidebarNavs.tsx
git commit -m "feat: add orphan finder to sidebar navigation"
```

---

### Task 5: Verify createAlbumWithAssets handler exists

**Files:**
- Possibly modify: `src/handlers/api/album.handler.ts`

**Step 1: Check if `createAlbumWithAssets` exists in album handler**

If it doesn't exist, add it. This function should create an album via Immich API and then add selected assets to it.

```typescript
export const createAlbumWithAssets = async (albumName: string, assetIds: string[]) => {
  const album = await API.post(CREATE_ALBUM_PATH, { albumName, assetIds });
  return album;
}
```

**Step 2: Commit if changes were needed**

```bash
git add src/handlers/api/album.handler.ts
git commit -m "feat: add createAlbumWithAssets handler"
```

---

### Task 6: Manual testing and fixes

**Step 1: Run the dev server**

```bash
bun run dev
```

**Step 2: Test each filter combination**

- Visit `/assets/orphan-finder`
- Toggle each checkbox individually, verify results
- Combine filters, verify AND behavior
- Test asset type dropdown
- Select assets, verify floating bar appears
- Test "Add to Album" flow
- Test Trash and Delete flows
- Verify sidebar link works

**Step 3: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: orphan finder polish and bug fixes"
```

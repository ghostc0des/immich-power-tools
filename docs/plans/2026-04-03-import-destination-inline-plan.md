# Import Destination Inline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move album destination selection from a dialog into an inline card on the import-shared screen, between the album details card and the gallery card.

**Architecture:** All changes are in a single file (`src/pages/assets/import-shared.tsx`). Remove `importAllDialogOpen` state and its Dialog component. Add a Destination card rendered inline when `sharedData && albumDetails`. The import button in the header calls `handleImportAll` directly. No backend changes needed.

**Tech Stack:** React, Next.js, shadcn/ui (Card, Button, Input, Select, Label)

---

### Task 1: Remove dialog state, update fetch trigger, wire import button directly

**Files:**
- Modify: `src/pages/assets/import-shared.tsx`

All changes are in one file. Read it fully before starting.

**Step 1: Remove `importAllDialogOpen` state**

Delete this line (~line 162):
```typescript
const [importAllDialogOpen, setImportAllDialogOpen] = useState(false);
```

**Step 2: Update the albums fetch effect**

The current effect fetches albums when the dialog opens. Change it to fetch when `sharedData` loads instead:

```typescript
// BEFORE
useEffect(() => {
  if (importAllDialogOpen) {
    listAlbums().then(setExistingAlbums).catch(console.error);
  }
}, [importAllDialogOpen]);

// AFTER
useEffect(() => {
  if (sharedData) {
    listAlbums().then(setExistingAlbums).catch(console.error);
  }
}, [sharedData]);
```

**Step 3: Update the Back button handler**

Remove `setImportAllDialogOpen(false)` from the Back button's onClick (it's one of the reset lines in the Header `leftComponent`).

**Step 4: Update the import button in the Header rightComponent**

Replace the current onClick (which opens the dialog) with a direct `handleImportAll` call:

```tsx
<Button
  variant="default"
  size="sm"
  disabled={
    importAllLoading ||
    importableAssetCount === 0 ||
    (albumImportMode === "existing-album" && !selectedAlbumId)
  }
  onClick={() => {
    if (importAllLoading) return;
    const shouldCreateAlbum = albumImportMode === "album";
    handleImportAll({
      createAlbum: shouldCreateAlbum,
      albumName: shouldCreateAlbum ? albumNameInput.trim() : undefined,
      addToAlbumId:
        albumImportMode === "existing-album" && selectedAlbumId
          ? selectedAlbumId
          : undefined,
    });
  }}
>
  {importAllLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {selectedAssetIds.size > 0
    ? `Import selected (${selectedAssetIds.size})`
    : "Import all"}
</Button>
```

Also remove the `setAlbumImportMode("album")` reset that was in the old onClick — the inline card owns the mode state now.

**Step 5: Commit**

```bash
git add src/pages/assets/import-shared.tsx
git commit -m "refactor: wire import button directly to handleImportAll, fetch albums on sharedData load"
```

---

### Task 2: Add inline Destination card

**Files:**
- Modify: `src/pages/assets/import-shared.tsx`

**Step 1: Find the insertion point**

In the JSX return, inside the `<section>` element, there is:
- An album details `<Card>` rendered when `sharedData` is set
- A gallery `<Card>` rendered when `sharedData && albumDetails`

Insert the Destination card between them — after the album details card, before the gallery card. It should only render when `sharedData && albumDetails` (same condition as the gallery).

**Step 2: Add the Destination card**

```tsx
{sharedData && albumDetails && (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Destination</CardTitle>
      <CardDescription>
        Choose where to save the imported assets in your Immich library.
      </CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant={albumImportMode === "album" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setAlbumImportMode("album")}
          disabled={importAllLoading}
        >
          Create a new album
        </Button>
        <Button
          type="button"
          variant={albumImportMode === "existing-album" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setAlbumImportMode("existing-album")}
          disabled={importAllLoading}
        >
          Existing album
        </Button>
        <Button
          type="button"
          variant={albumImportMode === "no-album" ? "default" : "outline"}
          className="flex-1"
          onClick={() => setAlbumImportMode("no-album")}
          disabled={importAllLoading}
        >
          No album
        </Button>
      </div>

      {albumImportMode === "album" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="destination-album-name">Album name</Label>
          <Input
            id="destination-album-name"
            value={albumNameInput}
            onChange={(e) => setAlbumNameInput(e.target.value)}
            placeholder="Imported shared album"
            disabled={importAllLoading}
          />
        </div>
      )}

      {albumImportMode === "existing-album" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="destination-existing-album">Select album</Label>
          <Select
            onValueChange={setSelectedAlbumId}
            value={selectedAlbumId || undefined}
            disabled={importAllLoading}
          >
            <SelectTrigger id="destination-existing-album">
              <SelectValue placeholder="Select an album" />
            </SelectTrigger>
            <SelectContent>
              {existingAlbums.map((album) => (
                <SelectItem key={album.id} value={album.id}>
                  {album.albumName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {importAllLoading && jobProgress && (
        <p className="text-sm text-muted-foreground">
          {jobProgress.uploaded + jobProgress.skipped} / {jobProgress.total} processed
          {jobProgress.failed > 0 && ` · ${jobProgress.failed} failed`}
        </p>
      )}
    </CardContent>
  </Card>
)}
```

**Step 3: Commit**

```bash
git add src/pages/assets/import-shared.tsx
git commit -m "feat: add inline destination card for album selection on import-shared screen"
```

---

### Task 3: Remove the import Dialog

**Files:**
- Modify: `src/pages/assets/import-shared.tsx`

The import Dialog (open/close controlled by `importAllDialogOpen`) now needs to be removed. The video and image preview Dialogs must be kept — do not touch those.

**Step 1: Remove the import Dialog JSX**

Delete the entire Dialog block that starts with:
```tsx
<Dialog
  open={importAllDialogOpen}
  onOpenChange={...}
>
  <DialogContent className="sm:max-w-md">
    ...
  </DialogContent>
</Dialog>
```

It ends just before the video preview Dialog (`<Dialog open={!!activeVideoAsset} ...>`).

**Step 2: Remove unused Dialog imports if any**

Check the import statement at the top. The `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` components are still used by the video and image preview dialogs — keep them. No imports need removing.

**Step 3: Verify the progress counter is gone from the dialog (it was moved to the Destination card in Task 2)**

Confirm no duplicate progress `<p>` exists.

**Step 4: Commit**

```bash
git add src/pages/assets/import-shared.tsx
git commit -m "refactor: remove import dialog, destination selection is now inline"
```

---

## Done

After Task 3:
- Album destination (create / existing / none) is visible on the screen without clicking anything
- The import button calls `handleImportAll` directly
- Progress shows inline in the Destination card while importing
- The import Dialog is gone
- No backend changes

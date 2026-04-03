# Import Destination Inline Design

**Date:** 2026-04-03

## Goal

Show album destination selection inline on the import-shared screen rather than inside a dialog, so users can set their target album before browsing and importing.

## Design

A "Destination" card is inserted between the album details card and the gallery card. It is only rendered when `sharedData` is loaded. The import dialog is removed entirely.

### Layout

```
[Album Details Card]
[Destination Card]   ← new
  Destination: [Create new album] [Existing Album] [No Album]
  Album name: [____________]    ← shown when "Create new album" selected
  Select album: [dropdown  ]    ← shown when "Existing Album" selected
  Progress: X / Y processed · Z failed  ← shown while importing
[Gallery Card]
```

### Behaviour changes

- The "Import all" / "Import selected (N)" header button calls `handleImportAll` directly without opening a dialog
- `importAllDialogOpen` state and the Dialog component are removed
- Album options are read from existing state: `albumImportMode`, `albumNameInput`, `selectedAlbumId`
- `existingAlbums` is fetched when `sharedData` loads (moved from `importAllDialogOpen` effect)
- Progress counter moves into the Destination card while importing
- Upload banner stays in the gallery card

### No backend changes

The `albumOptions` shape passed to `createImportJob` is unchanged.

## Files changed

- `src/pages/assets/import-shared.tsx` — only file touched

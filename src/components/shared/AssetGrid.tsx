import "yet-another-react-lightbox/styles.css";
import "react-photo-album/rows.css";

import { IAsset } from '@/types/asset';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import Lightbox from 'yet-another-react-lightbox';
import { RowsPhotoAlbum } from "react-photo-album";
import type { Photo, RenderImageContext, RenderImageProps } from "react-photo-album";
import LazyGridImage from "../ui/lazy-grid-image";
import Download from "yet-another-react-lightbox/plugins/download";
import Video from "yet-another-react-lightbox/plugins/video";
import { usePhotoSelectionContext } from '@/contexts/PhotoSelectionContext';
import { useConfig } from '@/contexts/ConfigContext';

export interface AssetPhoto extends Photo {
  id: string;
  isVideo: boolean;
  duration?: string;
  isSelected: boolean;
}

interface AssetGridProps {
  assets: IAsset[];
  isInternal?: boolean;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
}

interface AssetGridRef {
  getSelectedIds: () => string[];
  selectAll: () => void;
  unselectAll: () => void;
}

const AssetGrid = forwardRef<AssetGridRef, AssetGridProps>(({ assets, isInternal = true, selectable = false, onSelectionChange }, ref) => {
  const [index, setIndex] = useState(-1);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);
  const { exImmichUrl } = useConfig();
  // Use context for selection state
  const { selectedIds, updateContext } = usePhotoSelectionContext();

  useImperativeHandle(ref, () => ({
    getSelectedIds: () => selectedIds,
    selectAll: () => {
      const allIds = assets.map((asset) => asset.id);
      updateContext({ selectedIds: allIds });
      onSelectionChange?.(allIds);
    },
    unselectAll: () => {
      updateContext({ selectedIds: [] });
      onSelectionChange?.([]);
    },
  }), [assets, selectedIds, updateContext]);


  const handleClick = (index: number, asset: AssetPhoto, event: React.MouseEvent) => {
    if (selectedIds.length > 0) {
      handleSelect(index, asset, event);
    } else {
      setIndex(index);
    }
  }

  const handleSelect = (_idx: number, asset: AssetPhoto, event: React.MouseEvent) => {

    event.stopPropagation();
    const isPresent = selectedIds.includes(asset.id);
    if (isPresent) {
      const newSelectedIds = selectedIds.filter((id) => id !== asset.id);
      updateContext({ selectedIds: newSelectedIds });
      onSelectionChange?.(newSelectedIds);
    } else {
      const clickedIndex = images.findIndex((image) => {
        return image.id === asset.id;
      });
      if (event.shiftKey) {
        const startIndex = Math.min(clickedIndex, lastSelectedIndex);
        const endIndex = Math.max(clickedIndex, lastSelectedIndex);
        const rangeSelectedIds = images.slice(startIndex, endIndex + 1).map((image) => image.id);
        const allSelectedIds = [...selectedIds, ...rangeSelectedIds];
        const uniqueSelectedIds = [...new Set(allSelectedIds)];
        updateContext({ selectedIds: uniqueSelectedIds });
        onSelectionChange?.(uniqueSelectedIds);
      } else {
        const newSelectedIds = [...selectedIds, asset.id];
        updateContext({ selectedIds: newSelectedIds });
        onSelectionChange?.(newSelectedIds);
      }
      setLastSelectedIndex(clickedIndex);
    }
  };

  const slides = useMemo(() => {
    return assets.map((asset) => ({
      ...asset,
      orientation: 1,
      src: asset.previewUrl as string,
      type: (asset.type === "VIDEO" ? "video" : "image") as any,
      sources:
        asset.type === "VIDEO"
          ? [
            {
              src: asset.downloadUrl as string,
              type: "video/mp4",
            },
          ]
          : undefined,
      height: asset.exifImageHeight as number,
      width: asset.exifImageWidth as number,
      downloadUrl: asset.downloadUrl as string,
    }));
  }, [assets]);

  const images: AssetPhoto[] = useMemo(() => {
    return assets.map((p) => ({
      ...p,
      src: p.url as string,
      original: p.previewUrl as string,
      width: p.exifImageWidth as number,
      height: p.exifImageHeight as number,
      orientation: 1,
      isSelected: selectedIds.includes(p.id),
      isVideo: p.type === "VIDEO",
      duration: p.duration != null ? String(p.duration) : undefined,
      tags: [
        {
          title: "Immich Link",
          value: (
            <a href={exImmichUrl + "/photos/" + p.id} target="_blank" rel="noopener noreferrer">
              Open in Immich
            </a>
          ),
        },
      ],
    }));
  }, [assets, selectedIds, exImmichUrl]);

  const handleEsc = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      updateContext({ selectedIds: [] });
      onSelectionChange?.([]);
    }
  };

  useEffect(() => {
    // Listen for esc key press and unselect all images
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [images]);

  const renderImage = (props: RenderImageProps, context: RenderImageContext<AssetPhoto>) => {
    return (
      <LazyGridImage
        imageProps={props}
        photo={context.photo}
        width={context.width}
        height={context.height}
      />
    );
  };

  return (
    <div>
      <Lightbox
        slides={slides}
        plugins={[Download, Video]}
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
      />
      <RowsPhotoAlbum
        photos={images}
        targetRowHeight={150}
        onClick={({ index, event, photo }) => handleClick(index, photo, event)}
        render={{ image: renderImage }}
      />
    </div>
  );
})
AssetGrid.displayName = "AssetGrid";
export default AssetGrid;

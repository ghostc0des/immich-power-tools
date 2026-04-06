import "yet-another-react-lightbox/styles.css";

import { IAsset } from '@/types/asset';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState, useCallback } from 'react'
import Lightbox from 'yet-another-react-lightbox';
import { Gallery } from "react-grid-gallery";
import LazyGridImage from "../ui/lazy-grid-image";
import Download from "yet-another-react-lightbox/plugins/download";
import Video from "yet-another-react-lightbox/plugins/video";
import { usePhotoSelectionContext } from '@/contexts/PhotoSelectionContext';
import { useConfig } from '@/contexts/ConfigContext';
import dynamic from 'next/dynamic';
import { Heart, Info, Trash2, ExternalLink } from 'lucide-react';

const AssetInfoPanel = dynamic(() => import('@/components/asset-info/AssetInfoPanel'), { ssr: false });


interface AssetGridProps {
  assets: IAsset[];
  isInternal?: boolean;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  onDeleteAsset?: (id: string) => void;
  onFavoriteAsset?: (id: string, isFavorite: boolean) => void;
}

interface AssetGridRef {
  getSelectedIds: () => string[];
  selectAll: () => void;
  unselectAll: () => void;
}

const AssetGrid = forwardRef<AssetGridRef, AssetGridProps>(({ assets, isInternal = true, selectable = false, onSelectionChange, onDeleteAsset, onFavoriteAsset }, ref) => {
  const [index, setIndex] = useState(-1);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const { exImmichUrl } = useConfig();
  // Use context for selection state
  const { selectedIds, updateContext } = usePhotoSelectionContext();

  const currentAsset = index >= 0 && index < assets.length ? assets[index] : null;

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


  const handleClick = (index: number, asset: IAsset, event: React.MouseEvent<HTMLElement>) => {
    if (selectedIds.length > 0) {
      handleSelect(index, asset, event);
    } else {
      setIndex(index);
    }
  }

  const handleSelect = (_idx: number, asset: IAsset, event: React.MouseEvent<HTMLElement>) => {

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

  const images = useMemo(() => {
    return assets.map((p) => ({
      ...p,
      src: p.url as string,
      original: p.previewUrl as string,
      width: p.exifImageWidth / 10 as number,
      height: p.exifImageHeight / 10 as number,
      orientation: 1,
      isSelected: selectedIds.includes(p.id),
      isVideo: p.type === "VIDEO",
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

  const handleOpenInImmich = useCallback(() => {
    if (currentAsset) {
      window.open(exImmichUrl + "/photos/" + currentAsset.id, "_blank");
    }
  }, [currentAsset, exImmichUrl]);

  const toolbarButtons = useMemo(() => {
    if (!currentAsset) return [];
    return [
      <button
        key="favorite"
        type="button"
        className="yarl__button"
        title={currentAsset.isFavorite ? "Unfavorite" : "Favorite"}
        onClick={() => onFavoriteAsset?.(currentAsset.id, !currentAsset.isFavorite)}
      >
        <Heart
          className={`h-6 w-6 ${currentAsset.isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`}
        />
      </button>,
      <button
        key="info"
        type="button"
        className="yarl__button"
        title="Info"
        onClick={() => setShowInfoPanel((v) => !v)}
      >
        <Info className={`h-6 w-6 ${showInfoPanel ? 'text-blue-400' : 'text-white'}`} />
      </button>,
      <button
        key="open-immich"
        type="button"
        className="yarl__button"
        title="Open in Immich"
        onClick={handleOpenInImmich}
      >
        <ExternalLink className="h-6 w-6 text-white" />
      </button>,
      ...(onDeleteAsset ? [
        <button
          key="delete"
          type="button"
          className="yarl__button"
          title="Delete"
          onClick={() => {
            onDeleteAsset(currentAsset.id);
            setIndex(-1);
          }}
        >
          <Trash2 className="h-6 w-6 text-white" />
        </button>,
      ] : []),
    ];
  }, [currentAsset, showInfoPanel, onDeleteAsset, onFavoriteAsset, handleOpenInImmich]);

  return (
    <div>
      <Lightbox
        slides={slides}
        plugins={[Download, Video]}
        open={index >= 0}
        index={index}
        close={() => { setIndex(-1); setShowInfoPanel(false); }}
        on={{
          view: ({ index }) => setIndex(index),
        }}
        toolbar={{
          buttons: [
            ...toolbarButtons,
            "download",
            "close",
          ],
        }}
        render={{
          slideContainer: ({ children }) => (
            <div className="flex h-full w-full">
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                {children}
              </div>
              {showInfoPanel && currentAsset && (
                <AssetInfoPanel
                  assetId={currentAsset.id}
                />
              )}
            </div>
          ),
        }}
        styles={{
          container: {
            backgroundColor: "rgba(0, 0, 0, 0.95)",
          },
        }}
      />
      <Gallery
        images={images}
        onClick={handleClick}
        enableImageSelection={selectable}
        thumbnailImageComponent={LazyGridImage}
        onSelect={handleSelect}
      />
    </div>
  );
})
AssetGrid.displayName = "AssetGrid";
export default AssetGrid;

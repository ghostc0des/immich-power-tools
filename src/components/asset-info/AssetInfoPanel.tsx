import React, { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { humanizeBytes } from '@/helpers/string.helper'
import { useConfig } from '@/contexts/ConfigContext'
import {
  Calendar,
  Image as ImageIcon,
  Camera,
  Aperture,
  MapPin,
} from 'lucide-react'
import API from '@/lib/api'
import { PERSON_THUBNAIL_PATH } from '@/config/routes'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'

export interface IAssetDetail {
  id: string
  type: string
  originalPath: string
  originalFileName: string
  isFavorite: boolean
  duration: string | null
  localDateTime: string | Date
  fileCreatedAt: string | Date
  make: string | null
  model: string | null
  lensModel: string | null
  fNumber: number | null
  focalLength: number | null
  iso: number | null
  exposureTime: string | null
  fileSizeInByte: number | null
  exifImageWidth: number | null
  exifImageHeight: number | null
  orientation: string | null
  dateTimeOriginal: string | Date | null
  timeZone: string | null
  latitude: number | null
  longitude: number | null
  city: string | null
  state: string | null
  country: string | null
  description: string | null
  rating: number | null
  fps: number | null
  projectionType: string | null
  people: { personId: string; personName: string; thumbnailPath: string }[]
}

interface AssetInfoPanelProps {
  assetId: string
}

function getMegapixels(width: number, height: number): string {
  const mp = (width * height) / 1_000_000
  return mp >= 1 ? `${mp.toFixed(1)} MP` : `${(mp * 1000).toFixed(0)} KP`
}

function formatExposureTime(exposure: string): string {
  const val = parseFloat(exposure)
  if (isNaN(val)) return exposure
  if (val >= 1) return `${val} s`
  return `1/${Math.round(1 / val)} s`
}

function MiniMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Check if dark mode
    const isDark = document.documentElement.classList.contains('dark')

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
      doubleClickZoom: true,
      attributionControl: false,
    })

    mapRef.current = map

    const tileLayer = isDark
      ? L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 20,
        })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 20,
        })

    tileLayer.addTo(map)
    L.marker([latitude, longitude]).addTo(map)

    // Force resize after render
    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [latitude, longitude])

  return (
    <div className="rounded-lg overflow-hidden border h-[160px]">
      <div ref={mapContainerRef} className="h-full w-full" />
    </div>
  )
}

export default function AssetInfoPanel({ assetId }: AssetInfoPanelProps) {
  const [detail, setDetail] = useState<IAssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const { exImmichUrl } = useConfig()

  useEffect(() => {
    setLoading(true)
    API.get(`/api/assets/${assetId}/detail`)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [assetId])

  if (loading) {
    return (
      <div className="w-[360px] min-w-[360px] bg-background border-l overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-4">Info</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="w-[360px] min-w-[360px] bg-background border-l overflow-y-auto p-4">
        <h2 className="text-lg font-semibold mb-4">Info</h2>
        <p className="text-sm text-muted-foreground">Unable to load asset details.</p>
      </div>
    )
  }

  const dateStr = detail.dateTimeOriginal || detail.localDateTime
  const date = dateStr ? new Date(dateStr) : null

  const hasLocation = detail.latitude && detail.longitude
  const locationParts = [detail.city, detail.state, detail.country].filter(Boolean)

  const resolution = detail.exifImageWidth && detail.exifImageHeight
    ? `${detail.exifImageWidth} x ${detail.exifImageHeight}`
    : null
  const megapixels = detail.exifImageWidth && detail.exifImageHeight
    ? getMegapixels(detail.exifImageWidth, detail.exifImageHeight)
    : null

  return (
    <div className="w-[360px] min-w-[360px] bg-background border-l overflow-y-auto">
      {/* Header */}
      <div className="p-4 pb-2">
        <h2 className="text-lg font-semibold">Info</h2>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {/* Description */}
        {detail.description && (
          <p className="text-sm text-muted-foreground">{detail.description}</p>
        )}

        {/* People */}
        {detail.people && detail.people.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">People</h3>
            <div className="flex flex-wrap gap-2">
              {detail.people.map((p) => (
                <a
                  key={p.personId}
                  href={exImmichUrl + '/people/' + p.personId}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  <img
                    src={PERSON_THUBNAIL_PATH(p.personId)}
                    alt={p.personName}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span className="text-xs font-medium">{p.personName || 'Unknown'}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <hr className="border-border" />

        {/* Details */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Details</h3>
          <div className="space-y-3">
            {/* Date */}
            {date && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    {format(date, 'd MMM yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(date, 'EEE, HH:mm:ss')}
                    {detail.timeZone ? ` ${detail.timeZone}` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* File info */}
            <div className="flex items-start gap-3">
              <ImageIcon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{detail.originalFileName}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    megapixels,
                    resolution,
                    detail.fileSizeInByte ? humanizeBytes(detail.fileSizeInByte) : null,
                  ].filter(Boolean).join('  ')}
                </p>
              </div>
            </div>

            {/* Camera */}
            {(detail.make || detail.model) && (
              <div className="flex items-start gap-3">
                <Camera className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    {[detail.make, detail.model].filter(Boolean).join(' ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      detail.exposureTime ? formatExposureTime(detail.exposureTime) : null,
                      detail.iso ? `ISO ${detail.iso}` : null,
                    ].filter(Boolean).join('  ')}
                  </p>
                </div>
              </div>
            )}

            {/* Lens */}
            {detail.lensModel && (
              <div className="flex items-start gap-3">
                <Aperture className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium truncate max-w-[280px]">{detail.lensModel}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      detail.fNumber ? `f/${detail.fNumber}` : null,
                      detail.focalLength ? `${detail.focalLength} mm` : null,
                    ].filter(Boolean).join('  ')}
                  </p>
                </div>
              </div>
            )}

            {/* Location */}
            {(locationParts.length > 0 || hasLocation) && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  {locationParts.length > 0 ? (
                    locationParts.map((part, i) => (
                      <p key={i} className={i === 0 ? 'text-sm font-medium' : 'text-xs text-muted-foreground'}>
                        {part}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {detail.latitude?.toFixed(6)}, {detail.longitude?.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Map */}
            {hasLocation && (
              <MiniMap latitude={detail.latitude!} longitude={detail.longitude!} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

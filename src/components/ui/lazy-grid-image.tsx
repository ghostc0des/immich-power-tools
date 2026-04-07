/* eslint-disable @next/next/no-img-element */
import { humanizeDuration } from '@/helpers/string.helper'
import { PlayIcon } from '@radix-ui/react-icons'
import React, { useEffect } from 'react'
import type { RenderImageProps } from 'react-photo-album'
import type { AssetPhoto } from '../shared/AssetGrid'

interface LazyGridImageProps {
  imageProps: RenderImageProps;
  photo: AssetPhoto;
  width: number;
  height: number;
}

export default function LazyGridImage({ imageProps, photo, width, height }: LazyGridImageProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const imageRef = React.useRef<HTMLDivElement>(null)

  const setupObserver = () => {
    const observer = new IntersectionObserver((entries) => {
      
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      })
    })

    if (imageRef.current)  {
      observer.observe(imageRef.current)
    }
    return observer
  }

  useEffect(() => {
    const observer = setupObserver()
    return () => {
      observer?.disconnect()
    }
  }, [])

  if (!isVisible) return (
    <div style={{ height, width }} ref={imageRef} />
  )

  return (
    <div style={{ position: 'relative', width, height }}>
      <img {...imageProps} alt={imageProps.alt || ""} title="" style={{ ...imageProps.style, width, height, objectFit: 'cover' }} />
      {photo.isVideo && <div className="absolute bottom-2 right-2 bg-black/50 p-1 rounded-full flex items-center gap-1">
        <PlayIcon className="w-3 h-3 text-white" />
        {!!photo.duration && <span className="text-xs text-white">{humanizeDuration(photo.duration)}</span>}
      </div>}
    </div>
  )
}

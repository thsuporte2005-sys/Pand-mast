'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

export interface AppCarouselImage {
  id: string;
  image_url: string;
  alt_text?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

interface AppCarouselProps {
  appId: string;
  appName: string;
  carouselEnabled: boolean;
  images: AppCarouselImage[];
  className?: string;
  compact?: boolean;
}

const AUTOPLAY_INTERVAL_MS = 5000;
const AUTOPLAY_RESUME_DELAY_MS = 7000;

function wrapIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

export const AppCarousel = memo(function AppCarousel({
  appId,
  appName,
  carouselEnabled,
  images,
  className = '',
  compact = false,
}: AppCarouselProps) {
  const activeImages = useMemo(
    () =>
      images
        .filter((image) => image.is_active !== false)
        .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0)),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragOffsetRef = useRef(0);
  const resumeTimerRef = useRef<number | null>(null);
  const imageCount = activeImages.length;
  const visibleIndex = imageCount > 0 ? wrapIndex(activeIndex, imageCount) : 0;

  const pauseAutoplayTemporarily = useCallback(() => {
    setIsPaused(true);
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      setIsPaused(false);
      resumeTimerRef.current = null;
    }, AUTOPLAY_RESUME_DELAY_MS);
  }, []);

  const moveBy = useCallback(
    (direction: number, manual = true) => {
      if (imageCount <= 1) return;
      if (manual) pauseAutoplayTemporarily();
      setActiveIndex((current) => wrapIndex(current + direction, imageCount));
    },
    [imageCount, pauseAutoplayTemporarily]
  );

  const goTo = useCallback(
    (index: number) => {
      if (imageCount <= 1) return;
      pauseAutoplayTemporarily();
      setActiveIndex(wrapIndex(index, imageCount));
    },
    [imageCount, pauseAutoplayTemporarily]
  );

  useEffect(() => {
    if (!carouselEnabled || imageCount <= 1 || isPaused || isHovering || isDragging) return;

    const interval = window.setInterval(() => moveBy(1, false), AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [carouselEnabled, imageCount, isDragging, isHovering, isPaused, moveBy]);

  useEffect(
    () => () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    },
    []
  );

  const finishDrag = useCallback(() => {
    const offset = dragOffsetRef.current;
    if (Math.abs(offset) >= 42) moveBy(offset < 0 ? 1 : -1);
    setDragOffset(0);
    dragOffsetRef.current = 0;
    dragStartXRef.current = null;
    dragStartYRef.current = null;
    setIsDragging(false);
  }, [moveBy]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (imageCount <= 1 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pauseAutoplayTemporarily();
    dragStartXRef.current = event.clientX;
    dragStartYRef.current = event.clientY;
    dragOffsetRef.current = 0;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null || dragStartYRef.current === null) return;
    const nextOffset = event.clientX - dragStartXRef.current;
    const verticalOffset = event.clientY - dragStartYRef.current;

    if (Math.abs(nextOffset) <= Math.abs(verticalOffset)) return;
    event.preventDefault();
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartXRef.current === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
  };

  if (!carouselEnabled || imageCount === 0) return null;

  return (
    <section
      aria-label={`Banners de ${appName}`}
      className={className}
      data-app-id={appId}
      data-carousel-count={imageCount}
    >
      <div
        className={`group relative overflow-hidden border border-white/10 bg-[#0E223A] shadow-lg shadow-black/15 ${
          compact ? 'aspect-[16/9] rounded-xl' : 'aspect-[16/9] rounded-2xl'
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div
          aria-label={`Carrossel de banners de ${appName}`}
          className="h-full touch-pan-y overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#4DA3FF]"
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') moveBy(-1);
            if (event.key === 'ArrowRight') moveBy(1);
          }}
          onPointerCancel={handlePointerEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          role="region"
          tabIndex={imageCount > 1 ? 0 : -1}
        >
          <div
            className={`flex h-full ${isDragging ? '' : 'transition-transform duration-500 ease-out'}`}
            style={{
              transform: `translate3d(calc(${-visibleIndex * 100}% + ${dragOffset}px), 0, 0)`,
            }}
          >
            {activeImages.map((image, index) => (
              <div key={image.id} className="relative h-full min-w-full">
                <Image
                  alt={image.alt_text?.trim() || appName}
                  className="object-cover"
                  draggable={false}
                  fill
                  loading={index === 0 ? undefined : 'lazy'}
                  preload={index === 0}
                  sizes={compact ? '300px' : '(max-width: 768px) 100vw, 896px'}
                  src={image.image_url}
                />
              </div>
            ))}
          </div>
        </div>

        {!compact && imageCount > 1 && (
          <>
            <button
              aria-label="Banner anterior"
              className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#071A2F]/65 text-white opacity-0 backdrop-blur transition hover:bg-[#071A2F]/90 focus:opacity-100 group-hover:opacity-100 sm:flex"
              onClick={() => moveBy(-1)}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              aria-label="Próximo banner"
              className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#071A2F]/65 text-white opacity-0 backdrop-blur transition hover:bg-[#071A2F]/90 focus:opacity-100 group-hover:opacity-100 sm:flex"
              onClick={() => moveBy(1)}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {imageCount > 1 && (
        <div className={`flex items-center justify-center ${compact ? 'mt-2 gap-1.5' : 'mt-3 gap-2'}`}>
          {activeImages.map((image, index) => (
            <button
              aria-label={`Ir para banner ${index + 1}`}
              aria-current={index === visibleIndex ? 'true' : undefined}
              className={`rounded-full transition-all ${
                index === visibleIndex
                  ? compact
                    ? 'h-1.5 w-4 bg-[#4DA3FF]'
                    : 'h-2 w-6 bg-[#4DA3FF]'
                  : compact
                    ? 'h-1.5 w-1.5 bg-white/25 hover:bg-white/50'
                    : 'h-2 w-2 bg-white/25 hover:bg-white/50'
              }`}
              key={image.id}
              onClick={() => goTo(index)}
              type="button"
            />
          ))}
        </div>
      )}
    </section>
  );
});

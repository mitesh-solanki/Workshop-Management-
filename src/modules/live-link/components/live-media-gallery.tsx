"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LiveMediaItem = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  url: string;
  itemLabel: string;
};

type Props = {
  items: LiveMediaItem[];
};

const SWIPE_THRESHOLD = 50;
const LOADER_DELAY_MS = 160;

export function LiveMediaGallery({ items }: Props) {
  const t = useTranslations("liveLink");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left shadow-sm transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              aria-label={t("openMedia", { label: item.itemLabel })}
            >
              <div className="relative aspect-[4/3] w-full bg-slate-200">
                {item.kind === "PHOTO" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.itemLabel}
                    className="absolute inset-0 size-full object-cover object-center transition duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <>
                    <video
                      src={item.url}
                      muted
                      preload="metadata"
                      className="absolute inset-0 size-full object-cover object-center"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <span className="rounded-full bg-black/55 p-2.5 text-white">
                        <Play className="size-6 fill-current" aria-hidden />
                      </span>
                    </span>
                  </>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-3 pt-8 pb-2.5">
                  <p className="truncate text-sm font-medium text-white">
                    {item.itemLabel}
                  </p>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {activeIndex !== null ? (
        <LiveMediaLightbox
          items={items}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onIndexChange={setActiveIndex}
        />
      ) : null}
    </>
  );
}

type LightboxProps = {
  items: LiveMediaItem[];
  activeIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

function LiveMediaLightbox({
  items,
  activeIndex,
  onClose,
  onIndexChange,
}: LightboxProps) {
  const t = useTranslations("liveLink");
  const tCommon = useTranslations("common");
  const [mounted, setMounted] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(false);
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const loadedUrlsRef = useRef<Set<string>>(new Set());
  const loaderDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const active = items[activeIndex];
  const activeUrl = active?.url ?? null;
  const mediaVisible = Boolean(activeUrl && revealedUrl === activeUrl);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!activeUrl) return;

    if (loaderDelayRef.current) {
      clearTimeout(loaderDelayRef.current);
      loaderDelayRef.current = null;
    }

    if (loadedUrlsRef.current.has(activeUrl) || active?.kind === "VIDEO") {
      setRevealedUrl(activeUrl);
      setLoaderVisible(false);
      return;
    }

    setLoaderVisible(false);
    loaderDelayRef.current = setTimeout(() => {
      if (!loadedUrlsRef.current.has(activeUrl)) {
        setLoaderVisible(true);
      }
    }, LOADER_DELAY_MS);

    return () => {
      if (loaderDelayRef.current) {
        clearTimeout(loaderDelayRef.current);
        loaderDelayRef.current = null;
      }
    };
  }, [activeUrl, active?.kind]);

  const reveal = useCallback(
    (url: string) => {
      if (url !== activeUrl) return;
      loadedUrlsRef.current.add(url);
      if (loaderDelayRef.current) {
        clearTimeout(loaderDelayRef.current);
        loaderDelayRef.current = null;
      }
      setRevealedUrl(url);
      setLoaderVisible(false);
    },
    [activeUrl],
  );

  const showPrev = useCallback(() => {
    if (activeIndex > 0) onIndexChange(activeIndex - 1);
  }, [activeIndex, onIndexChange]);

  const showNext = useCallback(() => {
    if (activeIndex < items.length - 1) onIndexChange(activeIndex + 1);
  }, [activeIndex, items.length, onIndexChange]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") showPrev();
      if (event.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showPrev, showNext]);

  if (!mounted || !active || !activeUrl) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 px-2 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-4"
      role="dialog"
      aria-modal="true"
      aria-label={active.itemLabel}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-2 z-10 inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:top-4 sm:right-4"
        aria-label={tCommon("close")}
      >
        <X className="size-6" aria-hidden />
      </button>

      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-2 z-10 rounded-full bg-white/10 px-3 py-1 text-sm text-white sm:top-4 sm:left-4">
        {t("mediaCounter", {
          current: activeIndex + 1,
          total: items.length,
        })}
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          showPrev();
        }}
        disabled={activeIndex === 0}
        className="absolute top-1/2 left-1 z-10 inline-flex size-11 min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 sm:left-4"
        aria-label={t("previousMedia")}
      >
        <ChevronLeft className="size-7" aria-hidden />
      </button>

      <div
        className="relative mx-10 flex h-[min(70vh,720px)] w-full max-w-5xl items-center justify-center sm:mx-14 sm:h-[min(78vh,720px)]"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const endX = event.changedTouches[0]?.clientX;
          if (endX === undefined) return;
          const delta = endX - touchStartX.current;
          if (Math.abs(delta) > SWIPE_THRESHOLD) {
            if (delta > 0) showPrev();
            else showNext();
          }
          touchStartX.current = null;
        }}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300",
            loaderVisible ? "opacity-100" : "opacity-0",
          )}
          aria-live="polite"
          aria-busy={loaderVisible}
        >
          <Loader2
            className="size-10 animate-spin text-white/80"
            aria-hidden
          />
        </div>

        {active.kind === "PHOTO" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={activeUrl}
            src={activeUrl}
            alt={active.itemLabel}
            className={cn(
              "max-h-full max-w-full object-contain transition-opacity duration-300",
              mediaVisible ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => reveal(activeUrl)}
            onError={() => reveal(activeUrl)}
          />
        ) : (
          <video
            key={activeUrl}
            src={activeUrl}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
            onLoadedData={() => reveal(activeUrl)}
          />
        )}
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          showNext();
        }}
        disabled={activeIndex === items.length - 1}
        className="absolute top-1/2 right-1 z-10 inline-flex size-11 min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40 sm:right-4"
        aria-label={t("nextMedia")}
      >
        <ChevronRight className="size-7" aria-hidden />
      </button>

      <p
        className={cn(
          "mt-3 max-w-[min(100%,42rem)] truncate rounded-full bg-white/10 px-4 py-2 text-center text-sm font-medium text-white transition-opacity duration-300 sm:mt-4 sm:text-base",
          mediaVisible ? "opacity-100" : "opacity-0",
        )}
      >
        {active.itemLabel}
      </p>
    </div>,
    document.body,
  );
}

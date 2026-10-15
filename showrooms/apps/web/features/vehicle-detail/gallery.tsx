"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { useState } from "react";
import type { VehicleImage, VehicleVideo } from "@showrooms/shared";
import { cn } from "@/lib/utils";

export function Gallery({ title, images, videos }: { title: string; images: VehicleImage[]; videos: VehicleVideo[] }) {
  const [index, setIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const count = images.length;
  const go = (d: number) => {
    setShowVideo(false);
    setIndex((i) => (i + d + count) % count);
  };

  if (!count) return <div className="grid aspect-[4/3] place-items-center rounded-lg bg-surface text-ink-subtle">No photos</div>;
  const video = videos[0];

  return (
    <div className="space-y-3" aria-roledescription="carousel" aria-label={`${title} photos`}>
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-lg bg-ink"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        tabIndex={0}
      >
        {showVideo && video ? (
          <video src={video.url} poster={video.posterUrl} controls autoPlay playsInline className="h-full w-full object-contain" />
        ) : (
          <Image src={images[index]!.url} alt={`${title} — photo ${index + 1} of ${count}`} fill preload sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
        )}
        {count > 1 && !showVideo && (
          <>
            <button onClick={() => go(-1)} className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-card" aria-label="Previous photo">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => go(1)} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-card" aria-label="Next photo">
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute right-3 bottom-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white tabular">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {video && (
          <button onClick={() => setShowVideo(true)} className={cn("relative grid h-16 w-20 shrink-0 place-items-center rounded-md bg-ink text-white", showVideo && "ring-2 ring-accent")} aria-label="Play video">
            <PlayCircle className="size-6" />
          </button>
        )}
        {images.map((img, i) => (
          <button
            key={img.publicId}
            onClick={() => {
              setShowVideo(false);
              setIndex(i);
            }}
            className={cn("relative h-16 w-20 shrink-0 overflow-hidden rounded-md", i === index && !showVideo ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100")}
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === index && !showVideo}
          >
            <Image src={img.url} alt="" fill sizes="80px" className="object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { VideoItem } from '@/lib/featuredServicesData';

interface VideoLightboxProps {
  video: VideoItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoLightbox({ video, isOpen, onClose }: VideoLightboxProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isOpen) {
      el.play().catch(() => {});
      document.body.style.overflow = 'hidden';
    } else {
      el.pause();
      el.currentTime = 0;
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKey);
    }
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !video) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-sm px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white/80 transition-colors hover:text-white"
        aria-label="Close video"
      >
        <X size={32} />
      </button>
      <div
        className="relative w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={video.src}
          poster={video.poster}
          controls
          playsInline
          className="w-full rounded-lg"
        />
        <div className="mt-4 text-center text-white">
          <h3 className="font-serif text-xl">{video.title}</h3>
          <p className="mt-1 text-sm text-white/70">{video.location}</p>
        </div>
      </div>
    </div>
  );
}

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import VideoCard from './VideoCard';
import type { VideoItem } from '@/lib/featuredServicesData';

interface VideoStripProps {
  videos: VideoItem[];
  onVideoClick: (video: VideoItem) => void;
}

export default function VideoStrip({ videos, onVideoClick }: VideoStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  const scrollByCard = (direction: 'left' | 'right') => {
    const container = stripRef.current;
    if (!container) return;

    const cardWidth = container.firstElementChild?.getBoundingClientRect().width ?? 360;
    const gap = 16;
    const offset = direction === 'left' ? -(cardWidth + gap) : cardWidth + gap;

    container.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollByCard('left')}
        className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 p-2 text-[#002A3A] shadow-lg transition-colors hover:bg-white md:flex"
        aria-label="Scroll left"
      >
        <ChevronLeft size={24} />
      </button>

      <div
        ref={stripRef}
        className="video-strip scrollbar-hide"
      >
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} onClick={onVideoClick} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByCard('right')}
        className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/90 p-2 text-[#002A3A] shadow-lg transition-colors hover:bg-white md:flex"
        aria-label="Scroll right"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
}

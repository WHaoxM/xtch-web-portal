import { useEffect, useRef, useState } from 'react';
import { MapPin, Play } from 'lucide-react';
import type { VideoItem } from '@/lib/featuredServicesData';

interface VideoCardProps {
  video: VideoItem;
  onClick: (video: VideoItem) => void;
}

export default function VideoCard({ video, onClick }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isHovered) {
      el.muted = true;
      el.play().catch(() => {
        // Autoplay may be blocked; poster remains visible.
      });
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isHovered]);

  return (
    <div
      className="video-card group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(video)}
      role="button"
      tabIndex={0}
      aria-label={`Play video: ${video.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(video);
        }
      }}
    >
      {!posterFailed && (
        <img
          src={video.poster}
          alt={video.title}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            isHovered ? 'opacity-0' : 'opacity-100'
          }`}
          onError={() => setPosterFailed(true)}
        />
      )}
      <video
        ref={videoRef}
        src={video.src}
        muted
        loop
        playsInline
        preload={isHovered ? 'auto' : 'none'}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          isHovered && !posterFailed ? 'opacity-100' : 'opacity-0'
        } ${posterFailed ? 'opacity-100' : ''}`}
      />
      <div className="video-card-overlay" />
      <div className="video-card-play">
        <Play size={28} fill="white" className="ml-1" />
      </div>
      <div className="video-card-caption">
        <h4>{video.title}</h4>
        <p>{video.description}</p>
        <span className="location">
          <MapPin size={14} />
          {video.location}
        </span>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { SectionIntro } from '@/components/SiteSections';
import VideoStrip from '@/components/VideoStrip';
import VideoLightbox from '@/components/VideoLightbox';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import {
  heroVideo,
  storySections,
  serviceCapabilities,
  cta,
} from '@/lib/featuredServicesData';
import type { VideoItem } from '@/lib/featuredServicesData';

export default function FeaturedServices() {
  useScrollAnimation('.fs-anim');
  const [lightboxVideo, setLightboxVideo] = useState<VideoItem | null>(null);

  return (
    <div>
      {/* Hero */}
      <section className="relative flex min-h-[72vh] items-center justify-center overflow-hidden bg-[#061417]">
        <video
          src={heroVideo.src}
          poster={heroVideo.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#002A3A]/45 to-black/80" />

        <div className="hero-copy-shadow relative z-10 px-6 pt-28 text-center text-white">
          <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.22em] text-[#6FD1D7]">
            Featured Services
          </p>
          <h1 className="tocn-hero-title text-white">{heroVideo.title}</h1>
          <p className="mx-auto mt-6 max-w-3xl text-[16px] leading-8 text-white/88">
            {heroVideo.subtitle}
          </p>
        </div>
      </section>

      {/* Story Sections */}
      {storySections.map((section, index) => (
        <section
          key={section.id}
          className={`py-16 md:py-20 section-padding ${
            index % 2 === 1 ? 'bg-[#F6FAFE]' : 'bg-white'
          }`}
        >
          <div className="content-max-width">
            <div className="mb-10 fs-anim animate-fade-up">
              <SectionIntro
                eyebrow={section.eyebrow}
                title={section.title}
                text={section.description}
              />
            </div>
            <div className="fs-anim animate-fade-up">
              <VideoStrip
                videos={section.videos}
                onVideoClick={setLightboxVideo}
              />
            </div>
          </div>
        </section>
      ))}

      {/* Service Capabilities */}
      <section className="bg-[#002A3A] py-16 md:py-20 section-padding text-white">
        <div className="content-max-width">
          <div className="mb-12 text-center fs-anim animate-fade-up">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-[#6FD1D7]">
              How Syncing Makes It Happen
            </p>
            <h2 className="tocn-section-title text-white">What we arrange for you</h2>
            <p className="mx-auto mt-5 max-w-3xl text-[15px] leading-8 text-white/76">
              Every story above is backed by real local planning — not just ideas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {serviceCapabilities.map((capability) => (
              <div
                key={capability.themeId}
                className="rounded-[8px] border border-white/12 bg-white/[0.05] p-6 fs-anim animate-fade-up"
              >
                <h3 className="mb-4 font-serif text-[20px] text-white">
                  {capability.title}
                </h3>
                <ul className="space-y-3">
                  {capability.services.map((service) => (
                    <li
                      key={service}
                      className="flex items-start gap-3 text-[14px] leading-7 text-white/76"
                    >
                      <span className="mt-1 inline-flex shrink-0 text-[#6FD1D7]">
                        <Check size={14} />
                      </span>
                      {service}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding relative overflow-hidden bg-[#061417] py-16 md:py-20">
        <img
          src="/images/ref-banner-misty-river.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,12,15,0.96),rgba(0,42,58,0.78),rgba(0,0,0,0.3))]" />

        <div className="content-max-width relative z-10 text-center text-white fs-anim animate-fade-up">
          <h2 className="tocn-section-title text-white">{cta.title}</h2>
          <p className="mx-auto mt-5 max-w-3xl text-[15px] leading-8 text-white/78">
            {cta.text}
          </p>
          <Link
            to={cta.primaryTo}
            className="mt-9 inline-flex min-h-[52px] items-center justify-center gap-3 rounded-[6px] bg-white px-7 text-[15px] font-semibold text-[#002A3A] transition-colors hover:bg-[#F6FAFE]"
          >
            {cta.primaryLabel}
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <VideoLightbox
        video={lightboxVideo}
        isOpen={!!lightboxVideo}
        onClose={() => setLightboxVideo(null)}
      />
    </div>
  );
}

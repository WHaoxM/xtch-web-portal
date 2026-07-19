import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Crown,
  Gem,
  Headphones,
  Leaf,
  MapPin,
  Mountain,
  Send,
  ShieldCheck,
  Star,
  UsersRound,
  X,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { destinationMeta, routeTours, type RouteTour } from '@/lib/contentStore';

const STORY_AUTOPLAY_MS = 8000;
const STORY_RESUME_MS = 8000;

/** Preferred homepage Curated cards; fill gaps with other `featured` routes. */
const CURATED_PREFERRED_SLUGS = [
  '3-5-days-and-4-nights-in-beijing',
  '5-chengdu-jiuzhaigou-and-huanglong',
  '13-encounter-qinghai-and-gansu-grand-circuit',
] as const;

type CuratedJourneyCard = {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  days: string;
  places: string[];
  featured: boolean;
  wide: boolean;
};

const curatedJourneyFallback: CuratedJourneyCard[] = [
  {
    slug: '3-5-days-and-4-nights-in-beijing',
    title: '5-Day Beijing Classic Trip',
    subtitle: 'Imperial history, Great Wall & first China moments',
    image: '/images/route-beijing-greatwall-01.png',
    days: '5 Days',
    places: ['Beijing', 'Great Wall', 'Forbidden City'],
    featured: true,
    wide: true,
  },
  {
    slug: '5-chengdu-jiuzhaigou-and-huanglong',
    title: '5-Day Chengdu & Jiuzhaigou',
    subtitle: 'Pandas, soft city life & colorful mountain lakes',
    image: '/images/route-jiuzhaigou-lake-01.png',
    days: '5 Days',
    places: ['Chengdu', 'Jiuzhaigou', 'Huanglong'],
    featured: false,
    wide: false,
  },
  {
    slug: '13-encounter-qinghai-and-gansu-grand-circuit',
    title: '8-Day Qinghai & Gansu Loop',
    subtitle: 'Salt lakes, Silk Road color & northwest horizons',
    image: '/images/route-qinghai-mingsha-01.jpg',
    days: '8 Days',
    places: ['Qinghai', 'Dunhuang', 'Danxia'],
    featured: false,
    wide: false,
  },
];

function placeLabelsForTour(tour: RouteTour): string[] {
  const fromDestinations = tour.destinationSlugs
    .map((slug) => destinationMeta.find((destination) => destination.slug === slug)?.name)
    .filter((name): name is string => Boolean(name));
  if (fromDestinations.length > 0) return fromDestinations.slice(0, 3);
  return tour.destinationSlugs.slice(0, 3).map((slug) =>
    slug
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
  );
}

function tourToCuratedCard(tour: RouteTour, index: number): CuratedJourneyCard {
  return {
    slug: tour.slug,
    title: tour.title,
    subtitle: tour.desc,
    image: tour.image,
    days: tour.duration,
    places: placeLabelsForTour(tour),
    featured: index === 0,
    wide: index === 0,
  };
}

function selectCuratedJourneys(): CuratedJourneyCard[] {
  if (routeTours.length === 0) return curatedJourneyFallback;

  const bySlug = new Map(routeTours.map((tour) => [tour.slug, tour]));
  const selected: RouteTour[] = [];
  const used = new Set<string>();

  for (const slug of CURATED_PREFERRED_SLUGS) {
    const tour = bySlug.get(slug);
    if (!tour || used.has(tour.slug)) continue;
    selected.push(tour);
    used.add(tour.slug);
    if (selected.length >= 3) break;
  }

  if (selected.length < 3) {
    for (const tour of routeTours) {
      if (!tour.featured || used.has(tour.slug)) continue;
      selected.push(tour);
      used.add(tour.slug);
      if (selected.length >= 3) break;
    }
  }

  if (selected.length === 0) return curatedJourneyFallback;
  return selected.map((tour, index) => tourToCuratedCard(tour, index));
}

function curatedJourneyHref(slug: string, isMobile: boolean) {
  return isMobile ? `/china-trips?route=${encodeURIComponent(slug)}` : `/tours/${slug}`;
}

const curatedTrustItems = [
  {
    Icon: Gem,
    title: 'Expert Local Insight',
    text: 'Curated by travel specialists',
  },
  {
    Icon: ShieldCheck,
    title: 'Trusted & Secure',
    text: 'Clear, reliable arrangements',
  },
  {
    Icon: Headphones,
    title: 'On-Trip Support',
    text: 'Here to help, anytime',
  },
  {
    Icon: Star,
    title: 'Flexible & Private',
    text: 'Travel your way',
  },
];

const iconicMomentCards = [
  {
    image: '/images/syncing-real-place-great-wall-group.png',
    title: 'Great Wall',
    place: 'Beijing',
  },
  {
    image: '/images/syncing-real-place-forbidden-city-group.jpg',
    title: 'Forbidden City',
    place: 'Beijing',
  },
  {
    image: '/images/syncing-real-place-jiuzhaigou-lake.jpg',
    title: 'Jiuzhaigou Valley',
    place: 'Sichuan',
  },
  {
    image: '/images/syncing-real-place-xian-city-wall-bikes.jpg',
    title: "Xi'an City Wall",
    place: "Xi'an",
  },
  {
    image: '/images/syncing-real-place-leshan-buddha.jpg',
    title: 'Leshan Buddha',
    place: 'Sichuan',
  },
  {
    image: '/images/syncing-real-place-guilin-river.png',
    title: 'Li River',
    place: 'Guilin',
  },
];

const travelerMomentCards = [
  {
    image: '/images/syncing-real-traveler-shanghai-skyline.jpg',
    title: 'Shanghai Skyline',
  },
  {
    image: '/images/syncing-real-traveler-chongqing-night.jpg',
    title: 'Chongqing Night Walk',
  },
  {
    image: '/images/syncing-real-traveler-xian-pagoda.jpg',
    title: "Xi'an Pagoda Visit",
  },
  {
    image: '/images/syncing-real-traveler-mountain-stream.png',
    title: 'Mountain Stream Stop',
  },
  {
    image: '/images/syncing-real-traveler-group-dinner.jpg',
    title: 'Group Dinner',
  },
  {
    image: '/images/syncing-real-traveler-bund-friends.jpg',
    title: 'Bund Evening',
  },
  {
    image: '/images/syncing-real-traveler-highland-rest.png',
    title: 'Highland Rest Stop',
  },
];

type MomentLightbox = {
  source: 'iconic' | 'traveler';
  index: number;
};

const travelerStories = [
  {
    title: 'A Quiet Morning in Zhangjiajie',
    author: 'Emma & Daniel',
    country: 'United Kingdom',
    avatar: '/images/real-moment-3.jpg',
    mainImage: '/images/real-moment-3.jpg',
    polaroidImage: '/images/ref-tour-zhangjiajie.jpg',
    location: 'Zhangjiajie National Forest Park',
    polaroidCaption: "Morning views we'll never forget.",
    paragraphs: [
      'We woke up early to soft mist drifting between the sandstone peaks. The world was still, with only birdsong and the sound of our footsteps on the mountain path.',
      'Our guide led us to a quieter trail most visitors miss. We paused often, just to take it all in. Every view felt like a painting.',
      'It was one of those rare days that stays with you long after the journey ends.',
    ],
    quote: 'Peaceful, breathtaking, and so well looked after.',
    quoteSecondLine: 'It felt like China revealed its most gentle side to us.',
    tags: ['Zhangjiajie', 'Private Guide', 'Spring Travel', 'Photography'],
  },
  {
    title: 'Golden Light on the Li River',
    author: 'Maya & Chris',
    country: 'Australia',
    avatar: '/images/real-moment-2.jpg',
    mainImage: '/images/ref-tour-li-river.jpg',
    polaroidImage: '/images/route-guilin-bamboo-raft-01.jpg',
    location: 'Li River, Guilin',
    polaroidCaption: 'Slow water, soft mountains.',
    paragraphs: [
      'The river moved slowly past karst peaks and quiet villages. Our day never felt rushed, which made every stop feel personal and easy.',
      'We had time for photos, a village walk, and a simple lunch by the water. The landscape felt familiar from postcards, but much calmer in person.',
      'By sunset, the whole valley turned gold and we understood why people remember Guilin for years.',
    ],
    quote: 'The pace was exactly right.',
    quoteSecondLine: 'We saw the famous views without feeling pushed through them.',
    tags: ['Guilin', 'River Views', 'Slow Travel', 'Photo Time'],
  },
  {
    title: 'First Steps on the Great Wall',
    author: 'Laura & Michael',
    country: 'Canada',
    avatar: '/images/tour-greatwall.jpg',
    mainImage: '/images/tour-greatwall.jpg',
    polaroidImage: '/images/route-beijing-greatwall-01.png',
    location: 'Mutianyu Great Wall',
    polaroidCaption: 'A clear morning above Beijing.',
    paragraphs: [
      'We started before the busy hours and reached a quieter stretch just as the light opened over the hills.',
      'Our guide kept the story clear and never overloaded us with facts. There was room to walk, breathe, and simply enjoy being there.',
      'It became the moment that made China feel real, not just a long-planned destination.',
    ],
    quote: 'It felt grand, but never stressful.',
    quoteSecondLine: 'The planning gave us space to enjoy the day.',
    tags: ['Beijing', 'Great Wall', 'First Visit', 'Family Trip'],
  },
];

function TravelerStoryCarousel({ forcePaused }: { forcePaused: boolean }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const resumeTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const autoplaySelectRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const scheduleResume = useCallback(() => {
    clearResumeTimer();
    if (prefersReducedMotion || forcePaused) return;
    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null;
      setInteractionPaused(false);
    }, STORY_RESUME_MS);
  }, [clearResumeTimer, forcePaused, prefersReducedMotion]);

  const noteUserInteraction = useCallback(() => {
    setInteractionPaused(true);
    clearAdvanceTimer();
    if (!isHovering) {
      scheduleResume();
    } else {
      clearResumeTimer();
    }
  }, [clearAdvanceTimer, clearResumeTimer, isHovering, scheduleResume]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
      if (autoplaySelectRef.current) {
        autoplaySelectRef.current = false;
        return;
      }
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        return;
      }
      noteUserInteraction();
    };

    const onPointerDown = () => {
      noteUserInteraction();
    };

    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('pointerDown', onPointerDown);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('pointerDown', onPointerDown);
    };
  }, [emblaApi, noteUserInteraction]);

  const autoplayEnabled =
    Boolean(emblaApi) &&
    !prefersReducedMotion &&
    !forcePaused &&
    !isHovering &&
    !interactionPaused;

  useEffect(() => {
    clearAdvanceTimer();
    if (!autoplayEnabled || !emblaApi) return;

    advanceTimerRef.current = window.setTimeout(() => {
      autoplaySelectRef.current = true;
      emblaApi.scrollNext();
    }, STORY_AUTOPLAY_MS);

    return clearAdvanceTimer;
  }, [autoplayEnabled, clearAdvanceTimer, emblaApi, selectedIndex]);

  const wasExternallyPausedRef = useRef(false);

  useEffect(() => {
    if (forcePaused || prefersReducedMotion) {
      clearResumeTimer();
      clearAdvanceTimer();
      wasExternallyPausedRef.current = true;
      return;
    }
    if (wasExternallyPausedRef.current) {
      wasExternallyPausedRef.current = false;
      if (interactionPaused && !isHovering) {
        scheduleResume();
      }
    }
  }, [
    clearAdvanceTimer,
    clearResumeTimer,
    forcePaused,
    interactionPaused,
    isHovering,
    prefersReducedMotion,
    scheduleResume,
  ]);

  useEffect(
    () => () => {
      clearResumeTimer();
      clearAdvanceTimer();
    },
    [clearAdvanceTimer, clearResumeTimer],
  );

  const handleMouseEnter = () => {
    setIsHovering(true);
    clearResumeTimer();
    clearAdvanceTimer();
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (interactionPaused && !prefersReducedMotion && !forcePaused) {
      scheduleResume();
    }
  };

  const goToStory = (index: number) => {
    if (!emblaApi) return;
    if (emblaApi.selectedScrollSnap() === index) {
      noteUserInteraction();
      return;
    }
    emblaApi.scrollTo(index);
  };

  return (
    <div
      className="real-story-carousel"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="real-story-viewport" ref={emblaRef}>
        <div className="real-story-track">
          {travelerStories.map((story) => (
            <div key={story.title} className="real-story-feature">
              <article className="real-story-card">
                <div className="real-story-kicker">
                  <BookOpen size={29} strokeWidth={1.5} />
                  <span>Traveler Story</span>
                </div>
                <h3>{story.title}</h3>
                <div className="real-story-byline">
                  <span className="real-story-avatar">
                    <img src={story.avatar} alt="" />
                  </span>
                  <span>By {story.author}</span>
                  <i />
                  <span>{story.country}</span>
                </div>
                {story.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <blockquote>
                  {story.quote}
                  <br />
                  {story.quoteSecondLine}
                </blockquote>
                  <div className="real-story-tags">
                  {story.tags.map((tag, index) => {
                    const Icon = [MapPin, UsersRound, Leaf, Camera][index] ?? MapPin;
                    return (
                      <span key={tag}>
                        <Icon size={14} />
                        {tag}
                      </span>
                    );
                  })}
                  </div>
              </article>

              <div className="real-story-visual">
                <img
                  src={story.mainImage}
                  alt={story.location}
                  className="real-story-main-image"
                />
                <div className="real-story-location">
                  <MapPin size={20} />
                  {story.location}
                </div>
                <figure className="real-story-polaroid">
                  <img src={story.polaroidImage} alt={story.polaroidCaption} />
                  <figcaption>{story.polaroidCaption}</figcaption>
                </figure>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="real-story-dots" role="tablist" aria-label="Traveler stories">
        {travelerStories.map((story, index) => (
          <button
            key={story.title}
            type="button"
            role="tab"
            aria-label={`Show story: ${story.title}`}
            aria-selected={index === selectedIndex}
            className={index === selectedIndex ? 'active' : undefined}
            onClick={() => goToStory(index)}
          />
        ))}
      </div>
    </div>
  );
}

function RealMomentsSection() {
  const [lightbox, setLightbox] = useState<MomentLightbox | null>(null);
  const lightboxCards = lightbox?.source === 'iconic' ? iconicMomentCards : travelerMomentCards;
  const activeCard = lightbox === null ? null : lightboxCards[lightbox.index] ?? null;

  useEffect(() => {
    if (!lightbox) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightbox(null);
        return;
      }
      if (event.key === 'ArrowLeft') {
        setLightbox((current) => {
          if (!current) return null;
          const cards = current.source === 'iconic' ? iconicMomentCards : travelerMomentCards;
          return { ...current, index: (current.index - 1 + cards.length) % cards.length };
        });
        return;
      }
      if (event.key === 'ArrowRight') {
        setLightbox((current) => {
          if (!current) return null;
          const cards = current.source === 'iconic' ? iconicMomentCards : travelerMomentCards;
          return { ...current, index: (current.index + 1) % cards.length };
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightbox]);

  const closeLightbox = () => setLightbox(null);

  return (
    <div className={`real-moments-section${lightbox ? ' is-lightbox-open' : ''}`}>
      <div className="real-moments-header">
        <span className="real-moments-emblem">亭</span>
        <h2>REAL MOMENTS</h2>
        <p className="real-moments-script">From Our Private China Tours</p>
        <p className="real-moments-copy">
          Authentic experiences. Local connections. Unforgettable memories.
          <br />
          Discover the real China through the eyes of our travelers.
        </p>
      </div>

      <div className="real-moment-row">
        <div className="real-moment-row-head">
          <div className="real-moment-row-title">
            <Mountain size={44} strokeWidth={1.4} />
            <div>
              <h3>Iconic Places, Timeless Beauty</h3>
              <p>Curated destinations, beyond the guidebooks.</p>
            </div>
          </div>
        </div>

        <div className="real-moment-marquee">
          <div className="real-moment-track">
            {[...iconicMomentCards, ...iconicMomentCards].map((card, index) => (
              <button
                key={`${card.title}-${index}`}
                type="button"
                className="real-place-card"
                aria-label={`View ${card.title}, ${card.place}`}
                onClick={() =>
                  setLightbox({ source: 'iconic', index: index % iconicMomentCards.length })
                }
              >
                <img src={card.image} alt="" />
                <div className="real-place-card-shade" />
                <div className="real-place-card-caption">
                  <MapPin size={24} />
                  <div>
                    <h4>{card.title}</h4>
                    <p>{card.place}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="real-moment-row real-moment-row-second">
        <div className="real-moment-row-head">
          <div className="real-moment-row-title">
            <UsersRound size={44} strokeWidth={1.4} />
            <div>
              <h3>Real Travelers, Real Moments</h3>
              <p>Genuine smiles. Meaningful connections.</p>
            </div>
          </div>
        </div>

        <div className="real-moment-marquee real-moment-marquee-reverse">
          <div className="real-moment-track">
            {[...travelerMomentCards, ...travelerMomentCards].map((card, index) => (
              <button
                key={`${card.title}-${index}`}
                type="button"
                className="real-traveler-card"
                aria-label={`View ${card.title}`}
                onClick={() =>
                  setLightbox({ source: 'traveler', index: index % travelerMomentCards.length })
                }
              >
                <img src={card.image} alt="" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <TravelerStoryCarousel forcePaused={Boolean(lightbox)} />

      {activeCard && lightbox ? (
        <div
          className="real-moments-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeCard.title} photo`}
        >
          <button
            type="button"
            className="real-moments-lightbox-backdrop"
            aria-label="Close photo"
            onClick={closeLightbox}
          />
          <div className="real-moments-lightbox-panel">
            <header className="real-moments-lightbox-bar">
              <button type="button" onClick={closeLightbox} aria-label="Close">
                <X size={22} />
              </button>
              <div>
                <strong>{activeCard.title}</strong>
                {lightbox.source === 'iconic' ? (
                  <small>{iconicMomentCards[lightbox.index]?.place}</small>
                ) : null}
              </div>
              <span />
            </header>
            <div className="real-moments-lightbox-stage">
              <button
                type="button"
                className="real-moments-lightbox-nav"
                aria-label="Previous photo"
                onClick={() =>
                  setLightbox((current) => {
                    if (!current) return null;
                    const cards =
                      current.source === 'iconic' ? iconicMomentCards : travelerMomentCards;
                    return {
                      ...current,
                      index: (current.index - 1 + cards.length) % cards.length,
                    };
                  })
                }
              >
                <ChevronLeft size={28} />
              </button>
              <img src={activeCard.image} alt={activeCard.title} />
              <button
                type="button"
                className="real-moments-lightbox-nav"
                aria-label="Next photo"
                onClick={() =>
                  setLightbox((current) => {
                    if (!current) return null;
                    const cards =
                      current.source === 'iconic' ? iconicMomentCards : travelerMomentCards;
                    return { ...current, index: (current.index + 1) % cards.length };
                  })
                }
              >
                <ChevronRight size={28} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const isMobile = useIsMobile();
  const curatedJourneys = selectCuratedJourneys();

  return (
    <div className="bg-white text-[#002A3A]">
      <section className="home-reference-hero">
        <img
          src="/images/forbidden-city-beijing-palace-1.jpg"
          alt="Private China travel planned by Syncing Travel"
          className="home-reference-hero-image"
        />
        <div className="home-reference-hero-shade" />
        <div className="home-reference-hero-content">
          <div className="home-reference-hero-copy">
              <h1 className="home-reference-hero-title">
                PLAN YOUR PRIVATE
                <br />
                CHINA JOURNEY
              </h1>
              <div className="home-reference-hero-actions">
                <Link
                  to="/custom-trip"
                  className="home-reference-button home-reference-button-primary"
                >
                  Plan My Trip
                  <ArrowRight size={34} strokeWidth={1.35} />
                </Link>
                <Link
                  to="/china-trips"
                  className="home-reference-button home-reference-button-outline"
                >
                  <ArrowRight size={34} strokeWidth={1.35} />
                  Explore China Trips
                </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-reference-intro">
        <div className="home-reference-intro-inner">
          <h2 className="home-reference-intro-title">
            PRIVATE CHINA TRIPS,
            <br />
            PLANNED AROUND YOU
          </h2>
          <div className="home-reference-divider" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <p className="home-reference-intro-copy">
            We help overseas travelers turn China travel ideas into clear private routes,
            trusted local arrangements, and flexible days on the road. From destinations and
            hotels to guides, drivers, tickets, and on-trip support, your journey is shaped
            around your pace and interests.
          </p>
        </div>
      </section>

      <section className="recognition-section" aria-label="Featured in and recognized by">
        <div className="recognition-heading">
          <h2>Featured In &amp; Recognized By</h2>
          <div className="recognition-mark" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
        </div>
        <div className="recognition-panel">
          <img
            src="/images/recognition-media-logos.png"
            alt="CNN Travel, BBC Travel, USA Today, Outdoor, Lonely Planet, Tripadvisor, World Travel Awards, and ASTA"
            className="recognition-logo-strip"
          />
        </div>
      </section>

      <section className="curated-journeys-section">
        <div className="curated-journeys-inner">
          <div className="curated-journeys-kicker">
            <span />
            <p>Curated Journeys</p>
            <span />
          </div>
          <h2 className="curated-journeys-title">Explore China, Beautifully Curated</h2>
          <p className="curated-journeys-subtitle">
            Handpicked routes designed for first-time visitors, repeat explorers, and private
            custom travel.
          </p>

          <div className="curated-journeys-grid">
            {curatedJourneys.map((journey) => (
              <article
                key={journey.title}
                className={`curated-card ${journey.wide ? 'curated-card-wide' : ''}`}
              >
                <img src={journey.image} alt={journey.title} />
                <div className="curated-card-shade" />
                <div className="curated-card-top">
                  {journey.featured ? (
                    <span className="curated-pill curated-pill-gold">
                      <Star size={14} fill="currentColor" />
                      Most Popular
                    </span>
                  ) : (
                    <span className="curated-pill">
                      <CalendarDays size={14} />
                      {journey.days}
                    </span>
                  )}
                  {!journey.featured && (
                    <span className="curated-price">
                      <small>From</small>
                      <strong>On request</strong>
                    </span>
                  )}
                </div>
                <div className="curated-card-content">
                  <h3>{journey.title}</h3>
                  <p>{journey.subtitle}</p>
                  <div className="curated-tags">
                    {journey.places.map((place) => (
                      <span key={place}>
                        <MapPin size={14} fill="currentColor" />
                        {place}
                      </span>
                    ))}
                  </div>
                  <div className="curated-card-bottom">
                    {journey.featured && (
                      <p className="curated-from">
                        From <strong>On request</strong>
                      </p>
                    )}
                    <Link
                      to={curatedJourneyHref(journey.slug, isMobile)}
                      className="curated-button"
                    >
                      View Itinerary
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}

            <Link to="/custom-trip" className="curated-banner">
              <img src="/images/route-guilin-bamboo-raft-01.jpg" alt="Tailor-made private China tours" />
              <div className="curated-card-shade" />
              <div className="curated-banner-content">
                <span className="curated-banner-icon">
                  <Crown size={28} />
                </span>
                <div>
                  <h3>Tailor-Made Tours</h3>
                  <p>Private trips built around you.</p>
                  <span className="curated-button curated-button-compact">
                    Plan Your Trip
                    <ArrowRight size={17} />
                  </span>
                </div>
              </div>
            </Link>

            <Link to="/china-trips" className="curated-banner">
              <img src="/images/ref-tour-zhangjiajie.jpg" alt="More China tour routes" />
              <div className="curated-card-shade" />
              <div className="curated-banner-content">
                <span className="curated-banner-icon">
                  <Send size={26} />
                </span>
                <div>
                  <h3>More China Tours</h3>
                  <p>Explore more routes across China.</p>
                  <span className="curated-button curated-button-compact">
                    Browse All Tours
                    <ArrowRight size={17} />
                  </span>
                </div>
              </div>
            </Link>
          </div>

          <div className="curated-trust-bar">
            {curatedTrustItems.map(({ Icon, title, text }) => (
              <div key={title} className="curated-trust-item">
                <Icon size={36} strokeWidth={1.7} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-x-hidden bg-white py-18 section-padding md:py-24">
        <RealMomentsSection />
      </section>

      <section className="home-final-cta">
        <img
          src="/images/route-beijing-greatwall-01.png"
          alt="Great Wall private China trip"
          className="home-final-cta-image"
        />
        <div className="home-final-cta-shade" />
        <div className="home-final-cta-inner">
          <div className="home-final-cta-copy">
            <h2>
              READY TO PLAN YOUR
              <br />
              PRIVATE CHINA TOUR?
            </h2>
            <p>
              Tell us your travel dates, interests, group size, and budget - we'll design
              <br />
              a fully customized itinerary just for you.
              <br />
              Perfect for families, group travelers, and first-time visitors.
            </p>
            <Link to="/custom-trip" className="home-final-cta-button">
              Start Your Custom Trip
              <ArrowRight size={31} strokeWidth={1.45} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

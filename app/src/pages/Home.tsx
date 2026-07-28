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

/** Sourced from docs/桌面端内容/10位入境游客的中国旅行故事.docx (guest photos + trip notes). */
const travelerStories = [
  {
    title: 'More Than Pandas in Chengdu',
    author: 'Emma',
    country: 'Australia',
    avatar: '/images/traveler-story-01.jpg',
    mainImage: '/images/traveler-story-01.jpg',
    polaroidImage: '/images/dest-chengdu.jpg',
    location: "People's Park, Chengdu",
    polaroidCaption: 'A whole afternoon without opening my phone.',
    paragraphs: [
      'Emma came to Chengdu for the giant pandas — she loves panda souvenirs and wanted a holiday built around that soft, happy pace of life.',
      'Seeing the pandas was exciting. What stayed with her longer was an old teahouse in People’s Park: bamboo chairs, elders sipping tea and playing chess, dancers in the square.',
      'She spent a full afternoon there without opening her phone — the first time doing nothing felt like a real travel experience.',
    ],
    quote: 'What stayed with me more than the pandas',
    quoteSecondLine: 'was the way people in Chengdu live.',
    tags: ['Chengdu', 'Teahouse', 'Pandas', 'Slow Travel'],
  },
  {
    title: 'Future Skyline, Warm Streets',
    author: 'Sophie & Max',
    country: 'France',
    avatar: '/images/traveler-story-02.jpg',
    mainImage: '/images/traveler-story-02.jpg',
    polaroidImage: '/images/syncing-real-traveler-shanghai-skyline.jpg',
    location: 'Shanghai',
    polaroidCaption: 'Skyscrapers by day, Wukang Road by night.',
    paragraphs: [
      'Sophie and Max spent five days between Shanghai’s skyline and its quieter lanes — Shanghai Tower by day, evening walks along Wukang Road.',
      'Their guide traded Shanghai stories for French everyday life; one night they even went out for late street snacks together.',
      'They said the towers and the plane-tree cafés together made the deepest imprint of the city.',
    ],
    quote: 'It feels like the future,',
    quoteSecondLine: 'and still keeps the warmth of ordinary life.',
    tags: ['Shanghai', 'City Walks', 'Skyline', 'Food Stops'],
  },
  {
    title: 'Family Days from Palace to Grassland',
    author: 'The Smith Family',
    country: 'United States',
    avatar: '/images/traveler-story-03.jpg',
    mainImage: '/images/traveler-story-03.jpg',
    polaroidImage: '/images/syncing-real-place-forbidden-city-group.jpg',
    location: 'Beijing & Zhangjiakou',
    polaroidCaption: 'Mini dragon robes, then first horseback rides.',
    paragraphs: [
      'U.S. teacher Smith traveled North China with his wife and two children for a family culture trip.',
      'In Beijing they toured the Forbidden City — the kids tried mini dragon robes and learned simple court manners with their guide.',
      'Near Grassland Sky Road outside Zhangjiakou, the children learned riding and archery with Mongolian kids; their daughter went from nervous on a horse to excited at the sight of riders.',
    ],
    quote: 'Our daughter was scared on a horse at first —',
    quoteSecondLine: 'then every rider she saw made her excited.',
    tags: ['Beijing', 'Family Trip', 'Grassland', 'Forbidden City'],
  },
  {
    title: 'Quiet Lanes and Dongba Script',
    author: 'Carlos',
    country: 'Spain',
    avatar: '/images/traveler-story-04.jpg',
    mainImage: '/images/traveler-story-04.jpg',
    polaroidImage: '/images/dest-lijiang.jpg',
    location: 'Lijiang Old Town',
    polaroidCaption: 'A Naxi inn beside running water.',
    paragraphs: [
      'Madrid photographer Carlos prefers small, human stories over crowded photo spots.',
      'He stayed in a quiet Naxi inn deep in the old town — away from the bar street, with water at the door — and shot Jade Dragon Snow Mountain and Blue Moon Valley.',
      'At a Dongba culture studio he learned pictographs, wrote his name on a handmade Dongba-paper postcard, and later photographed elders sunning themselves in the lanes.',
    ],
    quote: 'Before I came I only knew Lijiang was pretty.',
    quoteSecondLine: 'Real daily life in the lanes felt stronger than any vista.',
    tags: ['Lijiang', 'Photography', 'Dongba', 'Naxi Culture'],
  },
  {
    title: 'Peaks, Then Mountain Songs',
    author: 'Lukas',
    country: 'Switzerland',
    avatar: '/images/traveler-story-05.jpg',
    mainImage: '/images/traveler-story-05.jpg',
    polaroidImage: '/images/ref-tour-zhangjiajie.jpg',
    location: 'Zhangjiajie',
    polaroidCaption: 'Pillars outside the window — trails fitted to my pace.',
    paragraphs: [
      'Bern outdoor traveler Lukas came for Zhangjiajie’s quartz sandstone pillars, with a mountain-view hotel at the park gate and private transfers.',
      'Besides Yuanjiajie, Tianzi Mountain, and Tianmen glass walkways, a custom quieter hike led into a Tujia village for hand-waving dance, Xilankapu weaving, cured meat, and sticky-rice wine.',
      'He said the peaks felt otherworldly — and the clearest surprise was Tujia hospitality and mountain songs.',
    ],
    quote: 'The pillars looked like another planet.',
    quoteSecondLine: 'The mountain songs stayed with me longer than the views.',
    tags: ['Zhangjiajie', 'Hiking', 'Tujia Culture', 'Private Guide'],
  },
  {
    title: 'Hotpot Lessons by the River',
    author: 'Lucas & Family',
    country: 'Belgium',
    avatar: '/images/traveler-story-06.jpg',
    mainImage: '/images/traveler-story-06.jpg',
    polaroidImage: '/images/route-chongqing-hongyadong-01.jpg',
    location: 'Chongqing',
    polaroidCaption: 'Hongya Cave lights from a riverside room.',
    paragraphs: [
      'Food-focused travelers from Brussels came for real Chongqing hotpot, staying by Hongya Cave so evening lights filled the room.',
      'Beyond Hongya Cave, Ciqikou, and the Yangtze cableway, a private class taught them to fry beef-tallow broth — milder chili for their heat limit — and mix a proper oil-dip sauce.',
      'A Chuanjiang Haozi heritage performance left them stunned; Lucas said the city’s roads feel magical, the hotpot hits right, and the people feel warm and relaxed.',
    ],
    quote: 'Magical roads, proper heat, easy people —',
    quoteSecondLine: 'Chongqing’s street life made us want to cook the broth again at home.',
    tags: ['Chongqing', 'Hotpot', 'Food Class', 'City Nights'],
  },
  {
    title: 'Karst Trails and Homemade Noodles',
    author: 'Mike & David',
    country: 'United States',
    avatar: '/images/traveler-story-07.jpg',
    mainImage: '/images/traveler-story-07.jpg',
    polaroidImage: '/images/route-chongqing-wulong-01.jpg',
    location: 'Chongqing & Wulong',
    polaroidCaption: 'Three Natural Bridges, then Fairy Mountain rides.',
    paragraphs: [
      'Outdoor traveler Mike and photographer David came southwest for karst country — hotpot in Chongqing first, Mike chasing water for the heat while David kept filming.',
      'In Wulong they hiked the Three Natural Bridges, rode on Fairy Mountain, and chased sheep across open grassland like kids again.',
      'That night at a local guesthouse they learned Chongqing small noodles with the host — not downtown-perfect, but they finished every bowl.',
    ],
    quote: 'The guesthouse noodles were not downtown-perfect,',
    quoteSecondLine: 'but we finished every bowl.',
    tags: ['Wulong', 'Karst', 'Hotpot', 'Photography'],
  },
  {
    title: 'Snow Peaks Without the Crowds',
    author: 'Jake & Mia',
    country: 'Australia',
    avatar: '/images/traveler-story-08.jpg',
    mainImage: '/images/traveler-story-08.jpg',
    polaroidImage: '/images/syncing-real-traveler-highland-rest.png',
    location: 'Western Sichuan',
    polaroidCaption: 'Oxygen-ready nights in Xinduqiao; stars at Yuzi West.',
    paragraphs: [
      'Jake and Mia wanted quiet highland scenery — Gongga snow peaks and night skies — not crowded stops.',
      'They stayed in an oxygen-ready Tibetan boutique hotel in Xinduqiao, traveled by 4WD with a local mountain driver, and stopped freely for sunset on the peaks.',
      'At Yuzi West star-view platform they faced snow ranges and prayer flags alone after peak hours; a streamside BBQ and trip photos rounded out the days.',
    ],
    quote: 'Healing and immense at once.',
    quoteSecondLine: 'No rush, no crowds — just highland care and open sky.',
    tags: ['Western Sichuan', 'Gongga', 'Starry Night', 'Couple Trip'],
  },
  {
    title: 'Tang Stories Made with His Hands',
    author: 'Lena & Aliex',
    country: 'Germany',
    avatar: '/images/traveler-story-09.jpg',
    mainImage: '/images/traveler-story-09.jpg',
    polaroidImage: '/images/syncing-real-place-xian-city-wall-bikes.jpg',
    location: "Xi'an",
    polaroidCaption: 'Courtyard nights under the Ming city wall.',
    paragraphs: [
      'German designer Lena brought her seven-year-old son Aliex to Xi’an so history could feel playful, staying in a Chinese courtyard hotel at the foot of the Ming wall.',
      'After the Terracotta Warriors, Giant Wild Goose Pagoda, and Great Tang All Day Mall lights, a Huazhou shadow-puppet inheritor guided Aliex to carve, paint, and perform a Journey to the West scene.',
      'He was so absorbed they extended the five-day trip by one more day; Lena said he had only known Tang stories from picture books before.',
    ],
    quote: 'I wanted him to touch another culture,',
    quoteSecondLine: 'so history felt alive — next holiday, he wants Egypt.',
    tags: ["Xi'an", 'Family Trip', 'Shadow Puppet', 'City Wall'],
  },
  {
    title: 'Slow Hours in Jiuzhaigou',
    author: 'Neal',
    country: 'Australia',
    avatar: '/images/traveler-story-10.jpg',
    mainImage: '/images/traveler-story-10.jpg',
    polaroidImage: '/images/syncing-real-place-jiuzhaigou-lake.jpg',
    location: 'Jiuzhaigou Valley',
    polaroidCaption: 'Long Lake at dawn; Five-Color Pond in the sun.',
    paragraphs: [
      'For Neal, Jiuzhaigou was only one stop on a longer China trip — until the lakes and forest still exceeded every photo and friend’s story.',
      'Dawn at Long Lake held snow peaks in the water; Five-Color Pond turned an almost impossible blue-green; the boardwalk forest was quiet enough to hear leaves move.',
      'Unlike rushed itineraries, he slowed down — fewer check-ins, more pauses — and left with a full camera and moments no lens fully kept.',
    ],
    quote: 'What stays is the whole valley’s feeling.',
    quoteSecondLine: 'Work and time fell away — only lake, forest, and mountains.',
    tags: ['Jiuzhaigou', 'Nature', 'Photography', 'Slow Travel'],
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
          src="/images/syncing-real-place-jiuzhaigou-lake.jpg"
          alt="Jiuzhaigou lake and mountain scenery"
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
                <Link
                  to="/group-tours"
                  className="home-reference-button home-reference-button-outline"
                >
                  Group Tours
                  <ArrowRight size={34} strokeWidth={1.35} />
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

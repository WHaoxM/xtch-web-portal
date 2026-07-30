export interface VideoItem {
  id: string;
  title: string;
  description: string;
  src: string;
  poster: string;
  location: string;
}

export interface StorySection {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  videos: VideoItem[];
}

export interface ServiceCapability {
  themeId: string;
  title: string;
  services: string[];
}

export const heroVideo = {
  src: '/videos/experiences/western-sichuan-foreigner.mp4',
  poster: '/images/experiences/hero-western-sichuan-poster.jpg',
  title: 'Traveler Stories',
  subtitle: 'Real moments, local access, planned for you.',
};

export const storySections: StorySection[] = [
  {
    id: 'hands-on-culture',
    eyebrow: 'Hands-On Culture',
    title: 'Make, Wear, and Create',
    description:
      'Step into workshops and heritage experiences that connect you with Chinese craft and tradition.',
    videos: [
      {
        id: 'xian-terracotta-workshop',
        title: 'Terracotta Warrior Workshop',
        description:
          'Shape your own clay figure with a local artisan in Xi\'an.',
        src: '/videos/experiences/xian-terracotta-workshop.mp4',
        poster: '/images/experiences/xian-terracotta-workshop-poster.jpg',
        location: 'Xi\'an',
      },
      {
        id: 'xian-hanfu-experience',
        title: 'Hanfu Costume Experience',
        description:
          'Dress in traditional Han dynasty attire and walk through ancient Chang\'an.',
        src: '/videos/experiences/xian-hanfu-experience.mp4',
        poster: '/images/experiences/xian-hanfu-experience-poster.jpg',
        location: 'Xi\'an',
      },
      {
        id: 'shanghai-rubbing-experience',
        title: 'Traditional Rubbing Craft',
        description:
          'Learn the intangible heritage art of stone rubbing in Shanghai.',
        src: '/videos/experiences/shanghai-rubbing-experience.mp4',
        poster: '/images/experiences/shanghai-rubbing-experience-poster.jpg',
        location: 'Shanghai',
      },
    ],
  },
  {
    id: 'landscapes-adventure',
    eyebrow: 'Landscapes & Adventure',
    title: 'Wide Horizons, Real Terrain',
    description:
      'From highland valleys to desert dunes, experience the scale of China\'s natural drama.',
    videos: [
      {
        id: 'western-sichuan-foreigner',
        title: 'Western Sichuan Highlands',
        description:
          'Snow peaks, Tibetan villages, and open road through western Sichuan.',
        src: '/videos/experiences/western-sichuan-foreigner.mp4',
        poster: '/images/experiences/western-sichuan-foreigner-poster.jpg',
        location: 'Western Sichuan',
      },
      {
        id: 'tibet-scenery-1',
        title: 'Tibet Plateau Views',
        description:
          'Sacred lakes, monastery ridges, and the vastness of the Tibetan plateau.',
        src: '/videos/experiences/tibet-scenery-1.mp4',
        poster: '/images/experiences/tibet-scenery-1-poster.jpg',
        location: 'Tibet',
      },
      {
        id: 'desert-offroad',
        title: 'Desert Off-Road Adventure',
        description: 'Dune bashing and desert adventure under wide-open skies.',
        src: '/videos/experiences/desert-offroad.mp4',
        poster: '/images/experiences/desert-offroad-poster.jpg',
        location: 'Qinghai-Gansu',
      },
    ],
  },
  {
    id: 'local-life-food-shows',
    eyebrow: 'Local Life, Food & Shows',
    title: 'Taste, Watch, and Live It',
    description:
      'Evening performances, street flavors, and everyday moments that make a trip personal.',
    videos: [
      {
        id: 'face-changing-fire',
        title: 'Sichuan Opera Face-Changing',
        description:
          'The famous bianlian mask change and fire-breathing spectacle.',
        src: '/videos/experiences/face-changing-fire.mp4',
        poster: '/images/experiences/face-changing-fire-poster.jpg',
        location: 'Chengdu',
      },
      {
        id: 'tang-palace-show-1',
        title: 'Tang Dynasty Palace Show',
        description:
          'A royal music and dance performance in the style of ancient Tang court.',
        src: '/videos/experiences/tang-palace-show-1.mp4',
        poster: '/images/experiences/tang-palace-show-1-poster.jpg',
        location: 'Xi\'an',
      },
      {
        id: 'city-wall-cycling',
        title: 'Ancient City Wall Cycling',
        description: 'Ride bicycles atop the centuries-old city fortifications.',
        src: '/videos/experiences/city-wall-cycling.mp4',
        poster: '/images/experiences/city-wall-cycling-poster.jpg',
        location: 'Xi\'an',
      },
    ],
  },
];

export const serviceCapabilities: ServiceCapability[] = [
  {
    themeId: 'hands-on-culture',
    title: 'Private Workshop & Heritage Access',
    services: [
      'Pre-booked artisan workshop sessions with English-speaking assistants',
      'Heritage craft experiences with take-home souvenirs',
      'Costume rental and photography coordination at historic sites',
      'Custom routing that pairs hands-on activities with city sightseeing',
    ],
  },
  {
    themeId: 'landscapes-adventure',
    title: 'Remote Region Logistics & Guides',
    services: [
      'High-altitude and remote-area travel permits and route planning',
      '4WD vehicle and driver-guide arrangements for off-road terrain',
      'Altitude-aware pacing with rest-day buffers',
      'Seasonal route selection based on road conditions and weather',
    ],
  },
  {
    themeId: 'local-life-food-shows',
    title: 'Evening Entertainment & Local Dining',
    services: [
      'Pre-reserved show tickets with best seating selection',
      'Local food tours and restaurant reservations',
      'Cycling and walking activity arrangements with equipment',
      'Night-market and street-food routing with guide accompaniment',
    ],
  },
];

export const cta = {
  title: 'Ready to live your own China story?',
  text: 'Tell us what you love. We\'ll build the itinerary, book the experiences, and handle the details.',
  primaryLabel: 'Plan My Trip',
  primaryTo: '/custom-trip',
};

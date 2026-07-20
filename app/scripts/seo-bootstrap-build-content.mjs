/**
 * Bootstrap committed SEO build snapshot from the known published catalog
 * (same titles/slugs as backfill-content / historical siteData). Use when DB
 * is unavailable; prefer seo-export-build-content when a target DB is ready.
 *
 * Usage: node scripts/seo-bootstrap-build-content.mjs
 */
import fs from 'node:fs';
import {
  SEO_BUILD_CONTENT_PATH,
  computeContentHash,
} from './seo-build-content.mjs';

function slugifyTourTitle(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const FIXED_EXPORTED_AT = '2026-07-20T00:00:00.000Z';

const destinationMeta = [
  {
    name: 'Beijing',
    slug: 'beijing',
    image: '/images/dest-beijing.jpg',
    description:
      'Beijing routes focus on the Forbidden City, Temple of Heaven, Great Wall, imperial history, and first-time China travel pacing.',
  },
  {
    name: 'Shanghai',
    slug: 'shanghai',
    image: '/images/dest-shanghai.jpg',
    description:
      'Shanghai routes are built around The Bund, city landmarks, water towns, modern skyline views, and short city-break planning.',
  },
  {
    name: 'Chengdu',
    slug: 'chengdu',
    image: '/images/dest-chengdu.jpg',
    description:
      'Chengdu routes connect pandas, Sichuan food, city life, Jiuzhaigou, Huanglong, and broader Sichuan combinations.',
  },
  {
    name: 'Western Sichuan',
    slug: 'western-sichuan',
    image: '/images/route-sichuan-yading.jpg',
    description:
      'Western Sichuan routes focus on snow mountains, Tibetan villages, Daocheng Yading, Jiuzhaigou, Huanglong, and photo-friendly highland travel.',
  },
  {
    name: 'Chongqing',
    slug: 'chongqing',
    image: '/images/dest-chongqing.jpg',
    description:
      'Chongqing routes include layered mountain-city views, hotpot, Wulong karst scenery, night views, and Sichuan-Chongqing regional loops.',
  },
  {
    name: 'Yunnan',
    slug: 'yunnan',
    image: '/images/dest-lijiang.jpg',
    description:
      'Yunnan routes cover Lijiang, Dali, Shangri-La, Xishuangbanna, old towns, highland scenery, and tropical southern China.',
  },
  {
    name: 'Guangxi',
    slug: 'guangxi',
    image: '/images/route-guilin.jpg',
    description:
      'Guangxi routes focus on Guilin, Yangshuo, Li River scenery, karst landscapes, caves, bamboo rafting, and southern China scenery.',
  },
  {
    name: 'Qinghai',
    slug: 'qinghai',
    image: '/images/route-qinghai-chaka.jpg',
    description:
      'Qinghai routes feature Qinghai Lake, Chaka Salt Lake, Chakaerhan Salt Lake, highland scenery, and northwest China grand circuits.',
  },
  {
    name: 'Gansu',
    slug: 'gansu',
    image: '/images/route-qinggan-danxia.jpg',
    description:
      'Gansu routes cover Dunhuang, Mogao Caves, Mingsha Mountain, Crescent Spring, Jiayuguan, Zhangye Danxia, and Silk Road landscapes.',
  },
  {
    name: 'Xinjiang',
    slug: 'xinjiang',
    image: '/images/route-xinjiang-yili.jpg',
    description:
      'Xinjiang routes include Ili grasslands, Sayram Lake, Kashgar, forest roads, lakes, and seasonal northern Xinjiang scenery.',
  },
  {
    name: 'Tibet',
    slug: 'tibet',
    image: '/images/route-tibet-yamdrok-01.jpg',
    description:
      'Tibet routes include Ali, Yamdrok Lake, Namtso, Lhasa, monastery culture, plateau scenery, and altitude-aware pacing.',
  },
  {
    name: "Xi'an",
    slug: 'xian',
    image: '/images/route-xian-huashan.jpg',
    description:
      "Xi'an routes focus on Terracotta Warriors, Qin and Tang heritage, ancient Chang'an culture, city walls, and Mount Huashan.",
  },
];

const realTours = [
  {
    id: 1,
    image: '/images/route-shanghai-night-01.jpg',
    title: 'One Day Shanghai City Tour',
    desc: 'A focused cultural day route covering Zhujiajiao Ancient Town, City God Temple Market, the Bund, Nanjing Road, Jin Mao Tower, and a Huangpu River cruise.',
    durationDays: 1,
    groupSize: 'Private / Small Group',
    category: 'City Break',
    featured: false,
    destinationSlugs: ['shanghai'],
  },
  {
    id: 2,
    image: '/images/route-shanghai-bund-01.jpg',
    title: '3 Days and 2 Nights in Shanghai',
    desc: 'A short Shanghai cultural route with Zhujiajiao, the Bund, Nanjing Road, City God Temple Market, the Oriental Pearl Tower, Yu Garden, and flexible city time.',
    durationDays: 3,
    groupSize: 'Private / Small Group',
    category: 'City Break',
    featured: true,
    destinationSlugs: ['shanghai'],
  },
  {
    id: 3,
    image: '/images/route-beijing-greatwall-01.png',
    title: '5 Days and 4 Nights in Beijing',
    desc: 'A first-time Beijing itinerary covering Tiananmen Square, the Forbidden City, Mutianyu Great Wall, Ming Tombs, the Summer Palace, and Olympic Park.',
    durationDays: 5,
    groupSize: 'Private / Small Group',
    category: 'Classic',
    featured: true,
    destinationSlugs: ['beijing'],
  },
  {
    id: 4,
    image: '/images/route-beijing-forbidden-01.png',
    title: 'Forbidden City and Temple of Heaven Day Tour',
    desc: 'A compact Beijing culture route for travelers with limited time, focused on the Palace Museum and the Temple of Heaven.',
    durationDays: 1,
    groupSize: 'Private / Small Group',
    category: 'Culture',
    featured: false,
    destinationSlugs: ['beijing'],
  },
  {
    id: 5,
    image: '/images/route-jiuzhaigou-lake-01.png',
    title: 'Chengdu, Jiuzhaigou and Huanglong',
    desc: 'A Sichuan route from Chengdu into Jiuzhaigou and Huanglong, with panda time, Minjiang valley views, colorful lakes, and a relaxed arrival day in Chengdu.',
    durationDays: 5,
    groupSize: '2-8 People',
    category: 'Nature',
    featured: true,
    destinationSlugs: ['chengdu', 'western-sichuan'],
  },
  {
    id: 6,
    image: '/images/route-yading-mountain-01.png',
    title: 'Where Yading Meets Jiuzhaigou',
    desc: 'An 8-day VIP small-group route through western Sichuan, linking Xinduqiao, Litang, Daocheng Yading, Jiuzhaigou, Huanglong, photo stops, and local meals.',
    durationDays: 8,
    groupSize: '2-8 People',
    category: 'Nature',
    featured: true,
    destinationSlugs: ['western-sichuan', 'chengdu'],
  },
  {
    id: 7,
    image: '/images/route-chongqing-wulong-01.jpg',
    title: 'Panoramic Sichuan and Chongqing',
    desc: 'A Chongqing-to-Chengdu route combining Wulong, Chongqing city views, panda time, Jiuzhaigou, Huanglong, Emei Mountain, Leshan Giant Buddha, and Sichuan food culture.',
    durationDays: 11,
    groupSize: 'Private / Small Group',
    category: 'Regional',
    featured: false,
    destinationSlugs: ['chongqing', 'chengdu', 'western-sichuan'],
  },
  {
    id: 8,
    image: '/images/route-chongqing-hongyadong-01.jpg',
    title: 'Chongqing Custom City Route',
    desc: 'A Chongqing route built around layered city views, night scenes, hotpot culture, Wulong karst scenery, and flexible airport or railway pickup.',
    durationDays: 5,
    groupSize: 'Private / Small Group',
    category: 'City Break',
    featured: false,
    destinationSlugs: ['chongqing'],
  },
  {
    id: 9,
    image: '/images/route-yunnan-shangri-la-01.png',
    title: 'Lijiang, Dali and Shangri-La',
    desc: 'An 8-day Yunnan journey through Lijiang, Dali, Shangri-La, old towns, snow mountain scenery, highland culture, and driver-guide pickup service.',
    durationDays: 8,
    groupSize: 'Private / Small Group',
    category: 'Nature',
    featured: true,
    destinationSlugs: ['yunnan'],
  },
  {
    id: 10,
    image: '/images/route-yunnan-xishuangbanna-01.jpg',
    title: 'Xishuangbanna Pure Travel Route',
    desc: 'A 5-day tropical Yunnan product from the real route library, focused on Dai culture, warm weather, forest scenery, and pure-travel pacing.',
    durationDays: 5,
    groupSize: 'Private / Small Group',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['yunnan'],
  },
  {
    id: 11,
    image: '/images/route-guilin-bamboo-raft-01.jpg',
    title: 'Colorful Guilin',
    desc: 'A 4-day Guilin route with Elephant Trunk Hill, Sun and Moon Twin Pagodas, Yangshuo, Yulong River scenery, bamboo rafting, Li River views, Gudong Waterfall, and Guanyan Cave.',
    durationDays: 4,
    groupSize: 'Private / Small Group',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['guangxi'],
  },
  {
    id: 12,
    image: '/images/route-guilin-li-river-01.jpg',
    title: 'Guangxi 7-Day Tour',
    desc: 'A deeper Guangxi route for 2-8 travelers, built around southern karst landscapes, local culture, river scenery, selected hotels, and no-shopping sightseeing.',
    durationDays: 7,
    groupSize: '2-8 People',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['guangxi'],
  },
  {
    id: 13,
    image: '/images/route-qinghai-mingsha-01.jpg',
    title: 'Encounter Qinghai and Gansu Grand Circuit',
    desc: 'An 8-day Lanzhou grand circuit through Qinghai Lake, Chaka Salt Lake, Chakaerhan Salt Lake, Xitai Jinair Lake, Yardang, Mogao Caves, Mingsha Mountain, Jiayuguan, and Rainbow Danxia.',
    durationDays: 8,
    groupSize: '2-8 People',
    category: 'Silk Road',
    featured: true,
    destinationSlugs: ['qinghai', 'gansu'],
  },
  {
    id: 14,
    image: '/images/route-qinghai-chaka-01.jpg',
    title: 'Qinghai Lake, Chaka and Dunhuang Route',
    desc: 'A 7-day spring and summer Qinghai-Gansu route featuring Qinghai Lake, Chaka Salt Lake, Chakaerhan Salt Lake, Emerald Lake, Mogao Caves, Mingsha Mountain, Crescent Spring, and Rainbow Danxia.',
    durationDays: 7,
    groupSize: '2-8 People',
    category: 'Silk Road',
    featured: false,
    destinationSlugs: ['qinghai', 'gansu'],
  },
  {
    id: 15,
    image: '/images/route-xinjiang-ili-valley-01.jpg',
    title: 'Wild Ili Northern Xinjiang',
    desc: 'A 7-day Ili route designed for younger travelers, with private scenic-area driving, grassland views, lakes, forest roads, and a light-luxury small-group pace.',
    durationDays: 7,
    groupSize: 'Up to 6 People',
    category: 'Silk Road',
    featured: true,
    destinationSlugs: ['xinjiang'],
  },
  {
    id: 16,
    image: '/images/route-xinjiang-mountain-lake-01.jpg',
    title: 'Kashgar and Ili Pure Travel Route',
    desc: 'A 10-day northern Xinjiang route with 4-diamond hotels, Sayram Lake, Tangbula Hundred-Mile Gallery, Mengkete Ancient Road, Kurdening, campfire experiences, and comfortable 1+1 business seats.',
    durationDays: 10,
    groupSize: '2-6 People',
    category: 'Silk Road',
    featured: false,
    destinationSlugs: ['xinjiang'],
  },
  {
    id: 17,
    image: '/images/route-xian-warriors-01.jpg',
    title: "Xi'an and Huashan Boutique Tour",
    desc: "A 7-day Shaanxi route through the millennial Chang'an atmosphere, Qin and Tang heritage, Terracotta Warriors, city culture, and Mount Huashan scenery.",
    durationDays: 7,
    groupSize: 'Private / Small Group',
    category: 'Culture',
    featured: false,
    destinationSlugs: ['xian'],
  },
  {
    id: 18,
    image: '/images/route-tibet-yamdrok-01.jpg',
    title: 'Tibet Ali Southern Line',
    desc: 'A 7-day Tibet route through Yamdrok Lake, Karola Glacier, Tashilhunpo Monastery, Guge Kingdom, Mapam Yumco, and optional Mount Kailash pilgrimage pacing.',
    durationDays: 7,
    groupSize: '2-6 People',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['tibet'],
  },
  {
    id: 19,
    image: '/images/route-tibet-potala-01.jpg',
    title: 'Northern Tibet 317 Legend',
    desc: 'A 10-day Sichuan-Tibet north route through Dege Printing House, Zizhu Temple, Sapu Snow Mountain, Namtso, Lhasa, selected hotels, and daily departures for small groups.',
    durationDays: 10,
    groupSize: 'Up to 4 People',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['tibet'],
  },
  {
    id: 20,
    image: '/images/route-qinghai-qilian-grassland-01.jpg',
    title: 'Panoramic Gansu-Qinghai 8-Day Tour',
    desc: 'A northwest grand loop with Qinghai Lake, Chaka Salt Lake, Hoh Xil, Chakaerhan, Xitai Jinair Lake, Yardang landforms, Mogao Caves, Mingsha Mountain, Crescent Spring, Zhangye Danxia, and Qilian Grassland.',
    durationDays: 8,
    groupSize: '2-6 People',
    category: 'Silk Road',
    featured: false,
    destinationSlugs: ['gansu', 'qinghai'],
  },
];

const destinations = destinationMeta.map((item, index) => ({
  slug: item.slug,
  name: item.name,
  description: item.description,
  image: item.image,
  displayOrder: index + 1,
  status: 'published',
  travelStyles: [],
  featuredOnHome: index < 6,
  featuredPriority: index + 1,
}));

const routes = realTours.map((tour) => ({
  slug: `${tour.id}-${slugifyTourTitle(tour.title)}`,
  legacyNumericId: tour.id,
  title: tour.title,
  subtitle: '',
  summary: tour.desc,
  durationDays: tour.durationDays,
  groupSizeDisplay: tour.groupSize,
  category: tour.category,
  themes: [],
  status: 'published',
  featured: tour.featured,
  heroImage: tour.image,
  pdfUrl: '',
  priceMode: 'on-request',
  priceDisplay: 'On request',
  primaryType: 'customizable',
  availableTypes: ['private', 'group-tour', 'customizable'],
  destinationSlugs: tour.destinationSlugs,
  experience: [],
  moments: [],
  includedSupport: [],
  itineraryDays: [],
}));

// Bootstrap has no reliable content mtimes — omit lastmod entries (stable sitemap).
const snapshot = {
  version: 1,
  exportedAt: FIXED_EXPORTED_AT,
  sourceEnv: 'bootstrap-catalog',
  contentHash: computeContentHash(destinations, routes),
  destinationCount: destinations.length,
  routeCount: routes.length,
  destinations,
  routes,
  updatedAtByPath: {},
};

fs.writeFileSync(SEO_BUILD_CONTENT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(
  `[seo-bootstrap] wrote ${destinations.length} destinations, ${routes.length} routes → ${SEO_BUILD_CONTENT_PATH}`,
);
console.log(`[seo-bootstrap] contentHash ${snapshot.contentHash}`);

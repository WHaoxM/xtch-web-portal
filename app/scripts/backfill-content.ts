/**
 * One-time backfill: copies the hardcoded `destinationMeta` / `realTours`
 * data from `src/lib/siteData.ts` (before its cleanup) into the `destinations`
 * / `routes` / `route_destinations` tables added by `contentSchema.ts`.
 *
 * Route `pdfUrl` is left null here: the itinerary PDFs are Vite `?url` asset
 * imports in `siteData.ts` and cannot be resolved by this plain Node/tsx
 * script. `pdfUrl` is not currently read by any UI component (see
 * docs/adr/0003), so this is safe for Phase 1.
 *
 * Route slugs are generated with the exact same `${id}-${slugify(title)}`
 * formula as `siteData.ts`'s `getTourSlug()`, so existing `/tours/:slug`
 * links and `routePdfDetails.ts` (keyed by `legacy_numeric_id`) keep working.
 *
 * Run once with: npx tsx scripts/backfill-content.ts
 */
import { ensureContentTables } from '../api/lib/contentSchema';
import { sql } from '../api/lib/db';
import { loadTargetEnv } from '../../scripts/env/targetEnv';

loadTargetEnv('local', { override: false });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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
    duration: '1 Day',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'City Break',
    featured: false,
    destinationSlugs: ['shanghai'],
  },
  {
    id: 2,
    image: '/images/route-shanghai-bund-01.jpg',
    title: '3 Days and 2 Nights in Shanghai',
    desc: 'A short Shanghai cultural route with Zhujiajiao, the Bund, Nanjing Road, City God Temple Market, the Oriental Pearl Tower, Yu Garden, and flexible city time.',
    duration: '3 Days',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'City Break',
    featured: true,
    destinationSlugs: ['shanghai'],
  },
  {
    id: 3,
    image: '/images/route-beijing-greatwall-01.png',
    title: '5 Days and 4 Nights in Beijing',
    desc: 'A first-time Beijing itinerary covering Tiananmen Square, the Forbidden City, Mutianyu Great Wall, Ming Tombs, the Summer Palace, and Olympic Park.',
    duration: '5 Days',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'Classic',
    featured: true,
    destinationSlugs: ['beijing'],
  },
  {
    id: 4,
    image: '/images/route-beijing-forbidden-01.png',
    title: 'Forbidden City and Temple of Heaven Day Tour',
    desc: 'A compact Beijing culture route for travelers with limited time, focused on the Palace Museum and the Temple of Heaven.',
    duration: '1 Day',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'Culture',
    featured: false,
    destinationSlugs: ['beijing'],
  },
  {
    id: 5,
    image: '/images/route-jiuzhaigou-lake-01.png',
    title: 'Chengdu, Jiuzhaigou and Huanglong',
    desc: 'A Sichuan route from Chengdu into Jiuzhaigou and Huanglong, with panda time, Minjiang valley views, colorful lakes, and a relaxed arrival day in Chengdu.',
    duration: '5 Days',
    groupSize: '2-8 People',
    price: 'On request',
    category: 'Nature',
    featured: true,
    destinationSlugs: ['chengdu', 'western-sichuan'],
  },
  {
    id: 6,
    image: '/images/route-yading-mountain-01.png',
    title: 'Where Yading Meets Jiuzhaigou',
    desc: 'An 8-day VIP small-group route through western Sichuan, linking Xinduqiao, Litang, Daocheng Yading, Jiuzhaigou, Huanglong, photo stops, and local meals.',
    duration: '8 Days',
    groupSize: '2-8 People',
    price: 'On request',
    category: 'Nature',
    featured: true,
    destinationSlugs: ['western-sichuan', 'chengdu'],
  },
  {
    id: 7,
    image: '/images/route-chongqing-wulong-01.jpg',
    title: 'Panoramic Sichuan and Chongqing',
    desc: 'A Chongqing-to-Chengdu route combining Wulong, Chongqing city views, panda time, Jiuzhaigou, Huanglong, Emei Mountain, Leshan Giant Buddha, and Sichuan food culture.',
    duration: '11 Days',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'Regional',
    featured: false,
    destinationSlugs: ['chongqing', 'chengdu', 'western-sichuan'],
  },
  {
    id: 8,
    image: '/images/route-chongqing-hongyadong-01.jpg',
    title: 'Chongqing Custom City Route',
    desc: 'A Chongqing route built around layered city views, night scenes, hotpot culture, Wulong karst scenery, and flexible airport or railway pickup.',
    duration: '5 Days',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'City Break',
    featured: false,
    destinationSlugs: ['chongqing'],
  },
  {
    id: 9,
    image: '/images/route-yunnan-shangri-la-01.png',
    title: 'Lijiang, Dali and Shangri-La',
    desc: 'An 8-day Yunnan journey through Lijiang, Dali, Shangri-La, old towns, snow mountain scenery, highland culture, and driver-guide pickup service.',
    duration: '8 Days',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'Nature',
    featured: true,
    destinationSlugs: ['yunnan'],
  },
  {
    id: 10,
    image: '/images/route-yunnan-xishuangbanna-01.jpg',
    title: 'Xishuangbanna Pure Travel Route',
    desc: 'A 5-day tropical Yunnan product from the real route library, focused on Dai culture, warm weather, forest scenery, and pure-travel pacing.',
    duration: '5 Days',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['yunnan'],
  },
  {
    id: 11,
    image: '/images/route-guilin-bamboo-raft-01.jpg',
    title: 'Colorful Guilin',
    desc: 'A 4-day Guilin route with Elephant Trunk Hill, Sun and Moon Twin Pagodas, Yangshuo, Yulong River scenery, bamboo rafting, Li River views, Gudong Waterfall, and Guanyan Cave.',
    duration: '4 Days',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['guangxi'],
  },
  {
    id: 12,
    image: '/images/route-guilin-li-river-01.jpg',
    title: 'Guangxi 7-Day Tour',
    desc: 'A deeper Guangxi route for 2-8 travelers, built around southern karst landscapes, local culture, river scenery, selected hotels, and no-shopping sightseeing.',
    duration: '7 Days',
    groupSize: '2-8 People',
    price: 'On request',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['guangxi'],
  },
  {
    id: 13,
    image: '/images/route-qinghai-mingsha-01.jpg',
    title: 'Encounter Qinghai and Gansu Grand Circuit',
    desc: 'An 8-day Lanzhou grand circuit through Qinghai Lake, Chaka Salt Lake, Chakaerhan Salt Lake, Xitai Jinair Lake, Yardang, Mogao Caves, Mingsha Mountain, Jiayuguan, and Rainbow Danxia.',
    duration: '8 Days',
    groupSize: '2-8 People',
    price: 'On request',
    category: 'Silk Road',
    featured: true,
    destinationSlugs: ['qinghai', 'gansu'],
  },
  {
    id: 14,
    image: '/images/route-qinghai-chaka-01.jpg',
    title: 'Qinghai Lake, Chaka and Dunhuang Route',
    desc: 'A 7-day spring and summer Qinghai-Gansu route featuring Qinghai Lake, Chaka Salt Lake, Chakaerhan Salt Lake, Emerald Lake, Mogao Caves, Mingsha Mountain, Crescent Spring, and Rainbow Danxia.',
    duration: '7 Days',
    groupSize: '2-8 People',
    price: 'On request',
    category: 'Silk Road',
    featured: false,
    destinationSlugs: ['qinghai', 'gansu'],
  },
  {
    id: 15,
    image: '/images/route-xinjiang-ili-valley-01.jpg',
    title: 'Wild Ili Northern Xinjiang',
    desc: 'A 7-day Ili route designed for younger travelers, with private scenic-area driving, grassland views, lakes, forest roads, and a light-luxury small-group pace.',
    duration: '7 Days',
    groupSize: 'Up to 6 People',
    price: 'On request',
    category: 'Silk Road',
    featured: true,
    destinationSlugs: ['xinjiang'],
  },
  {
    id: 16,
    image: '/images/route-xinjiang-mountain-lake-01.jpg',
    title: 'Kashgar and Ili Pure Travel Route',
    desc: 'A 10-day northern Xinjiang route with 4-diamond hotels, Sayram Lake, Tangbula Hundred-Mile Gallery, Mengkete Ancient Road, Kurdening, campfire experiences, and comfortable 1+1 business seats.',
    duration: '10 Days',
    groupSize: '2-6 People',
    price: 'On request',
    category: 'Silk Road',
    featured: false,
    destinationSlugs: ['xinjiang'],
  },
  {
    id: 17,
    image: '/images/route-xian-warriors-01.jpg',
    title: "Xi'an and Huashan Boutique Tour",
    desc: "A 7-day Shaanxi route through the millennial Chang'an atmosphere, Qin and Tang heritage, Terracotta Warriors, city culture, and Mount Huashan scenery.",
    duration: '7 Days',
    groupSize: 'Private / Small Group',
    price: 'On request',
    category: 'Culture',
    featured: false,
    destinationSlugs: ['xian'],
  },
  {
    id: 18,
    image: '/images/route-tibet-yamdrok-01.jpg',
    title: 'Tibet Ali Southern Line',
    desc: 'A 7-day Tibet route through Yamdrok Lake, Karola Glacier, Tashilhunpo Monastery, Guge Kingdom, Mapam Yumco, and optional Mount Kailash pilgrimage pacing.',
    duration: '7 Days',
    groupSize: '2-6 People',
    price: 'On request',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['tibet'],
  },
  {
    id: 19,
    image: '/images/route-tibet-potala-01.jpg',
    title: 'Northern Tibet 317 Legend',
    desc: 'A 10-day Sichuan-Tibet north route through Dege Printing House, Zizhu Temple, Sapu Snow Mountain, Namtso, Lhasa, selected hotels, and daily departures for small groups.',
    duration: '10 Days',
    groupSize: 'Up to 4 People',
    price: 'On request',
    category: 'Nature',
    featured: false,
    destinationSlugs: ['tibet'],
  },
  {
    id: 20,
    image: '/images/route-qinghai-qilian-grassland-01.jpg',
    title: 'Panoramic Gansu-Qinghai 8-Day Tour',
    desc: 'A northwest grand loop with Qinghai Lake, Chaka Salt Lake, Hoh Xil, Chakaerhan, Xitai Jinair Lake, Yardang landforms, Mogao Caves, Mingsha Mountain, Crescent Spring, Zhangye Danxia, and Qilian Grassland.',
    duration: '8 Days',
    groupSize: '2-6 People',
    price: 'On request',
    category: 'Silk Road',
    featured: false,
    destinationSlugs: ['gansu', 'qinghai'],
  },
];

function parseDurationDays(duration: string): number {
  const match = duration.match(/^(\d+)/);
  return match ? Number(match[1]) : 1;
}

async function backfill() {
  await ensureContentTables();

  for (const [index, destination] of destinationMeta.entries()) {
    await sql`
      INSERT INTO destinations (slug, name, description, image, display_order, status)
      VALUES (${destination.slug}, ${destination.name}, ${destination.description}, ${destination.image}, ${index}, 'published')
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        image = EXCLUDED.image,
        display_order = EXCLUDED.display_order,
        updated_at = NOW()
    `;
    console.log(`Upserted destination: ${destination.slug}`);
  }

  for (const tour of realTours) {
    const slug = `${tour.id}-${slugify(tour.title)}`;
    const durationDays = parseDurationDays(tour.duration);

    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO routes (
          slug, legacy_numeric_id, title, subtitle, summary, duration_days,
          group_size_display, category, themes, status, featured, hero_image,
          pdf_url, price_mode, price_display, primary_type, available_types
        ) VALUES (
          ${slug}, ${tour.id}, ${tour.title}, ${''}, ${tour.desc}, ${durationDays},
          ${tour.groupSize}, ${tour.category}, ${[]}, 'published', ${tour.featured}, ${tour.image},
          ${null}, 'on-request', ${tour.price}, 'customizable', ${['customizable']}
        )
        ON CONFLICT (slug) DO UPDATE SET
          legacy_numeric_id = EXCLUDED.legacy_numeric_id,
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          duration_days = EXCLUDED.duration_days,
          group_size_display = EXCLUDED.group_size_display,
          category = EXCLUDED.category,
          status = EXCLUDED.status,
          featured = EXCLUDED.featured,
          hero_image = EXCLUDED.hero_image,
          price_display = EXCLUDED.price_display,
          updated_at = NOW()
      `;

      await tx`DELETE FROM route_destinations WHERE route_slug = ${slug}`;
      for (const destinationSlug of tour.destinationSlugs) {
        await tx`
          INSERT INTO route_destinations (route_slug, destination_slug)
          VALUES (${slug}, ${destinationSlug})
          ON CONFLICT DO NOTHING
        `;
      }
    });
    console.log(`Upserted route: ${slug}`);
  }

  const destinationCount = await sql`SELECT COUNT(*)::int AS count FROM destinations`;
  const routeCount = await sql`SELECT COUNT(*)::int AS count FROM routes`;
  console.log(`Done. destinations=${destinationCount.rows[0].count} routes=${routeCount.rows[0].count}`);

  await sql.end();
}

backfill().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});

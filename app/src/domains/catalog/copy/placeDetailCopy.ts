/** Slug-keyed place detail copy used by Mini-App PlaceDetail and Admin preview. */

export function getPlaceBestFor(slug: string) {
  if (['beijing', 'shanghai', 'xian'].includes(slug)) return 'First-time China';
  if (['western-sichuan', 'qinghai', 'xinjiang', 'tibet', 'guangxi'].includes(slug)) {
    return 'Scenery lovers';
  }
  if (['chengdu', 'chongqing'].includes(slug)) return 'Food & local life';
  if (slug === 'gansu') return 'Silk Road culture';
  return 'Private route planning';
}

export function getPlacePace(slug: string) {
  if (['western-sichuan', 'qinghai', 'xinjiang', 'tibet', 'gansu'].includes(slug)) return 'Slower';
  if (['shanghai', 'beijing', 'xian'].includes(slug)) return 'Easy';
  return 'Flexible';
}

export function getPlaceSeason(slug: string) {
  if (['xinjiang', 'qinghai', 'western-sichuan', 'tibet'].includes(slug)) return 'May-Oct';
  if (['beijing', 'xian', 'gansu'].includes(slug)) return 'Spring/Fall';
  if (slug === 'yunnan') return 'Year-round';
  return 'Flexible';
}

export function getPlaceWhy(slug: string) {
  if (slug === 'beijing') {
    return 'The clearest introduction to imperial China, the Great Wall, ritual spaces, hutongs, and classic first-trip pacing.';
  }
  if (slug === 'shanghai') {
    return 'A polished city break with skyline views, riverfront walks, food, water towns, and easy arrival or departure logistics.';
  }
  if (slug === 'chengdu') {
    return 'A softer-paced base for pandas, Sichuan food, teahouses, and onward routes into Jiuzhaigou or western Sichuan.';
  }
  if (slug === 'western-sichuan') {
    return 'Highland scenery, Tibetan villages, snow mountains, Jiuzhaigou, Huanglong, and strong photography value.';
  }
  if (slug === 'gansu') {
    return 'A Silk Road route area with Mogao Caves, desert scenery, Danxia landforms, and historic trade-route atmosphere.';
  }
  return 'A strong China route area when the trip is matched to season, transport time, scenery, and traveler pace.';
}

export function getPlaceTiming(slug: string) {
  if (['western-sichuan', 'qinghai', 'xinjiang', 'tibet'].includes(slug)) {
    return 'Season and road conditions matter.';
  }
  if (['beijing', 'shanghai', 'xian'].includes(slug)) {
    return 'Works well as an arrival or core city stop.';
  }
  return 'Flexible with private planning.';
}

export function getPlacePlanningNote(slug: string) {
  if (['western-sichuan', 'qinghai', 'xinjiang', 'tibet'].includes(slug)) {
    return 'Leave buffer for long drives, altitude, and weather.';
  }
  if (['beijing', 'shanghai', 'xian'].includes(slug)) {
    return 'Group nearby sights together to avoid rushed days.';
  }
  return 'Match hotel location and daily pace to your route.';
}

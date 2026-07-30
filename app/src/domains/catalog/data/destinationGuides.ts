export type DestinationGuideContent = {
  overview: string;
  whyVisit: string;
  topThings: string[];
  bestTime: string;
  tips: string[];
  videoId?: string;
};

export const destinationContent: Record<string, DestinationGuideContent> = {
  beijing: {
    overview:
      'Beijing works best when the city is planned by story and area, not as a checklist. Imperial landmarks, hutong neighborhoods, parks, and the Great Wall each need enough time to feel coherent.',
    whyVisit:
      'It is one of the clearest introductions to China’s imperial history, ritual spaces, capital identity, and everyday northern city life.',
    topThings: ['Forbidden City', 'Mutianyu Great Wall', 'Temple of Heaven', 'Summer Palace', 'Hutong neighborhoods'],
    bestTime: 'Spring and autumn are the easiest seasons for comfortable walking, clearer skies, and full-day sightseeing.',
    tips: ['Book major sights early', 'Keep the Great Wall as the main plan of the day', 'Group central sights by area'],
    videoId: '2CXxbTyEOoM',
  },
  shanghai: {
    overview:
      'Shanghai is useful as a short city break, arrival city, or modern contrast after more historic destinations. Its rhythm is compact, urban, and easy to combine with nearby water-town experiences.',
    whyVisit:
      'The city shows modern China through skyline views, riverfront walks, historic concessions, food, shopping, and polished city logistics.',
    topThings: ['The Bund', 'Lujiazui skyline', 'Yu Garden', 'Nanjing Road', 'Zhujiajiao Ancient Town'],
    bestTime: 'Spring and autumn are comfortable; winter is quieter, while summer can be humid but lively.',
    tips: ['Plan Bund and skyline views around weather', 'Use Shanghai for arrival or departure', 'Keep water-town visits unhurried'],
  },
  chengdu: {
    overview:
      'Chengdu is both a soft-paced city destination and a gateway into Sichuan nature routes. It works well for pandas, food, tea culture, and onward travel to Jiuzhaigou or Huanglong.',
    whyVisit:
      'It gives travelers a gentler local rhythm before or after mountain scenery, with strong food culture and practical transport connections.',
    topThings: ['Giant panda bases', 'Local teahouses', 'Sichuan cuisine', 'Kuanzhai Alley', 'Jiuzhaigou gateway planning'],
    bestTime: 'Spring and autumn are comfortable; summer is green in mountain areas, while winter can be quieter.',
    tips: ['Start panda visits early', 'Leave buffer before mountain transfers', 'Plan food experiences by spice tolerance'],
  },
  'western-sichuan': {
    overview:
      'Western Sichuan is a highland route area rather than a single city. Travel days are longer, scenery is dramatic, and route pacing matters more than squeezing in too many stops.',
    whyVisit:
      'It is strong for snow mountains, Tibetan villages, Daocheng Yading, Jiuzhaigou, Huanglong, and photography-driven routes.',
    topThings: ['Daocheng Yading', 'Jiuzhaigou', 'Huanglong', 'Xinduqiao', 'Litang highland scenery'],
    bestTime: 'Late spring to autumn usually gives the best balance of road access, color, and mountain visibility.',
    tips: ['Respect altitude and long drives', 'Pack layers', 'Avoid overloading consecutive scenic days'],
  },
  chongqing: {
    overview:
      'Chongqing is a layered mountain-river city with strong night views, food culture, and access to Wulong karst scenery. It also combines naturally with Chengdu and Sichuan routes.',
    whyVisit:
      'The city feels visually different from flat urban destinations, with steep streets, river bridges, hotpot, and dramatic skyline views.',
    topThings: ['Hongya Cave area', 'Yangtze River views', 'Wulong karst scenery', 'Hotpot neighborhoods', 'Night skyline routes'],
    bestTime: 'Spring and autumn are comfortable; summer is hot, humid, and vivid at night.',
    tips: ['Plan around hills and traffic', 'Keep night-view time flexible', 'Combine Wulong as a full scenic day'],
  },
  yunnan: {
    overview:
      'Yunnan routes are about varied altitude, old towns, highland culture, and softer scenery. Lijiang, Dali, Shangri-La, and Xishuangbanna each need different pacing.',
    whyVisit:
      'It is a strong choice for travelers who want old towns, snow mountains, minority cultures, lakes, and warmer southern landscapes.',
    topThings: ['Lijiang Old Town', 'Dali and Erhai Lake', 'Shangri-La', 'Yulong Snow Mountain', 'Xishuangbanna'],
    bestTime: 'Spring and autumn are balanced; winter can work well in warmer southern Yunnan.',
    tips: ['Watch altitude changes', 'Avoid rushing old towns', 'Match clothing to different elevations'],
  },
  guangxi: {
    overview:
      'Guangxi is centered on karst scenery, rivers, caves, and countryside pacing around Guilin and Yangshuo. It is best when the itinerary leaves room for slow scenic movement.',
    whyVisit:
      'The region gives travelers classic southern China landscapes with Li River views, bamboo rafting, limestone peaks, and relaxed rural scenes.',
    topThings: ['Guilin city sights', 'Yangshuo countryside', 'Li River scenery', 'Yulong River', 'Karst caves'],
    bestTime: 'Spring and autumn are comfortable; early summer can be lush but wetter.',
    tips: ['Keep river days flexible for weather', 'Choose Yangshuo pacing carefully', 'Use scenic transfers instead of rushing'],
  },
  qinghai: {
    overview:
      'Qinghai sits at high elevation and is often part of a northwest loop. Lakes, salt flats, open roads, and big landscapes are the main reason to come.',
    whyVisit:
      'It is strong for Qinghai Lake, Chaka Salt Lake, Chakaerhan, plateau scenery, and photography-heavy routes.',
    topThings: ['Qinghai Lake', 'Chaka Salt Lake', 'Chakaerhan Salt Lake', 'Emerald Lake', 'Highland road scenery'],
    bestTime: 'Late spring through early autumn is usually best for lake color, road conditions, and long scenic days.',
    tips: ['Expect long drives', 'Prepare for elevation', 'Protect against sun and wind'],
  },
  gansu: {
    overview:
      'Gansu brings the Silk Road side of China into focus: caves, desert, passes, Danxia landforms, and historic trade-route atmosphere.',
    whyVisit:
      'It is ideal for travelers interested in Dunhuang, Mogao Caves, Mingsha Mountain, Crescent Spring, Jiayuguan, and Zhangye Danxia.',
    topThings: ['Mogao Caves', 'Mingsha Mountain', 'Crescent Spring', 'Jiayuguan', 'Rainbow Danxia'],
    bestTime: 'Spring and autumn are most comfortable for desert and heritage sightseeing.',
    tips: ['Book Mogao Caves carefully', 'Plan desert stops around light and heat', 'Use Gansu with Qinghai for a loop'],
  },
  xinjiang: {
    overview:
      'Xinjiang routes cover very large distances and strong seasonal scenery. The best trips are planned around region, road access, and landscape timing.',
    whyVisit:
      'It is strong for Ili grasslands, Sayram Lake, Kashgar, forest roads, mountain views, and Silk Road culture.',
    topThings: ['Ili grasslands', 'Sayram Lake', 'Kashgar', 'Tangbula scenery', 'Northern Xinjiang roads'],
    bestTime: 'Late spring through autumn is the main scenic season, with timing depending on grassland and road conditions.',
    tips: ['Do not underestimate distances', 'Plan by region', 'Match route timing to seasonal scenery'],
  },
  tibet: {
    overview:
      'Tibet travel needs careful altitude pacing, permit awareness, and realistic driving days. The reward is a powerful mix of plateau scenery and spiritual culture.',
    whyVisit:
      'It is strong for lakes, monasteries, Lhasa, Ali routes, Namtso, glaciers, and high-plateau landscapes.',
    topThings: ['Yamdrok Lake', 'Tashilhunpo Monastery', 'Namtso', 'Ali southern line', 'Lhasa route planning'],
    bestTime: 'Spring to autumn is the main travel window, with route choice depending on altitude and road conditions.',
    tips: ['Build in altitude buffer', 'Keep documents consistent', 'Avoid rushing long plateau days'],
  },
  xian: {
    overview:
      "Xi'an is a compact but historically dense city that works well as a cultural extension after Beijing or before western China routes.",
    whyVisit:
      'It brings Qin, Han, and Tang history into focus through the Terracotta Warriors, city walls, old neighborhoods, and Mount Huashan extensions.',
    topThings: ['Terracotta Warriors', "Xi'an City Wall", 'Muslim Quarter', 'Tang heritage sites', 'Mount Huashan'],
    bestTime: 'Spring and autumn are most comfortable for city walks and Huashan extensions.',
    tips: ['Give the Terracotta Warriors enough time', 'Plan Huashan as a separate day', 'Keep evening food walks flexible'],
  },
};

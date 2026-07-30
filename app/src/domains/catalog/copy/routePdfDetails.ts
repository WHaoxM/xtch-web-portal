export type RoutePdfDay = {
  title: string;
  text: string;
};

export type RoutePdfDetail = {
  source: string;
  tourCode: string;
  experience: string[];
  moments: string[];
  days: RoutePdfDay[];
  included: string[];
  notes: string[];
};

const commonIncluded = [
  'Private itinerary planning based on your dates, pace, and group size',
  'Local guide, driver, transfers, tickets, and hotel coordination where needed',
  'Pre-trip communication and practical on-trip support from the China-based team',
];

const commonNotes = [
  'The final route can be adjusted around flights, train times, hotel level, season, and walking pace.',
  'Some attraction tickets, cable cars, cruises, shows, or optional experiences may vary by date and availability.',
  'A private quote is prepared after the traveler shares dates, group size, and preferred comfort level.',
];

export const routePdfDetails: Record<number, RoutePdfDetail> = {
  1: {
    source: 'One day Shanghai tour.pdf',
    tourCode: 'ST-SHA-1D',
    experience: [
      'A compact cultural day in Shanghai built from the original route PDF.',
      'The day links Zhujiajiao Ancient Town, City God Temple Mall, the Bund, Nanjing Road, Jin Mao Tower, and a Huangpu River cruise.',
    ],
    moments: ['Water-town lanes in Zhujiajiao', 'Classic Bund architecture', 'Evening Huangpu River skyline'],
    days: [
      {
        title: 'Day 1 - Zhujiajiao, Old City, the Bund & Huangpu River',
        text: 'Meet your guide and driver, visit Zhujiajiao Ancient Town, continue to City God Temple Mall, the Bund, Nanjing Road, Jin Mao Tower, and finish with a Huangpu River cruise before transfer onward.',
      },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  2: {
    source: '3 days and 2 nights in Shanghai.pdf',
    tourCode: 'ST-SHA-3D',
    experience: [
      'A short Shanghai city stay focused on water-town charm, classic city landmarks, and relaxed cultural time.',
      'The PDF route combines Zhujiajiao, the Oriental Pearl Tower, the Bund, Nanjing Road, Jin Mao Tower, Yuyuan Garden, and City God Temple Mall.',
    ],
    moments: ['Zhujiajiao old bridges', 'Oriental Pearl skyline views', 'Yuyuan Garden and old Shanghai streets'],
    days: [
      { title: 'Day 1 - Arrival in Shanghai', text: 'Meet at the station or airport and transfer to the hotel for check-in and rest.' },
      { title: 'Day 2 - Zhujiajiao, Oriental Pearl, the Bund & River Cruise', text: 'Visit Zhujiajiao Ancient Town, then return to the city for the Oriental Pearl Tower, the Bund, Nanjing Road, Jin Mao Tower, and a Huangpu River cruise.' },
      { title: 'Day 3 - Yuyuan Garden, City God Temple Mall & Departure', text: 'Explore Yuyuan Garden and City God Temple Mall before transfer according to the return train or flight schedule.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  3: {
    source: '5 days and 4 nights in Beijing.pdf',
    tourCode: 'ST-BJS-5D',
    experience: [
      'A first-time Beijing route from the PDF covering imperial history, royal gardens, the Great Wall, and city culture.',
      'The trip includes Tiananmen Square, the Forbidden City, Mutianyu Great Wall, Ming Tombs, Summer Palace, Temple of Heaven, Yonghe Temple, Shichahai, and Olympic Park.',
    ],
    moments: ['Forbidden City palace axis', 'Mutianyu Great Wall', 'Summer Palace lake and gardens'],
    days: [
      { title: 'Day 1 - Arrival in Beijing', text: 'Guide and driver meet you on arrival and transfer you to the hotel for check-in.' },
      { title: 'Day 2 - Tiananmen Square, Forbidden City & Shichahai', text: 'Start with Tiananmen Square, continue through the Palace Museum, then enjoy the lake and hutong atmosphere around Shichahai.' },
      { title: 'Day 3 - Summer Palace & Olympic Park', text: 'Visit the Summer Palace royal garden and continue to Olympic Park for modern Beijing landmarks.' },
      { title: 'Day 4 - Mutianyu Great Wall & Ming Tombs', text: 'Travel outside the city for the Mutianyu section of the Great Wall and the Ming imperial burial area.' },
      { title: 'Day 5 - Departure from Beijing', text: 'Transfer is arranged according to the train or flight schedule.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  4: {
    source: 'The Forbidden City-Temple of Heaven Beijing day tour.pdf',
    tourCode: 'ST-BJS-1D',
    experience: [
      'A focused Beijing culture day for travelers with limited time.',
      'The original PDF centers on the Palace Museum and Temple of Heaven, two of Beijing’s strongest heritage landmarks.',
    ],
    moments: ['Forbidden City halls', 'Temple of Heaven ritual architecture', 'Central Beijing history'],
    days: [
      { title: 'Day 1 - Forbidden City & Temple of Heaven', text: 'Meet your guide and driver, tour the Palace Museum, then continue to the Temple of Heaven before transfer back or onward.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  5: {
    source: '成都-九寨沟-黄龙5天4晚.pdf',
    tourCode: 'ST-SIC-5D',
    experience: [
      'A Sichuan nature route linking Chengdu, pandas, Jiuzhaigou, Huanglong, Tibetan and Qiang cultural experiences, and scenic valley drives.',
      'The extracted PDF itinerary includes Chengdu arrival, Chengdu Panda Base, Jiuzhaigou deep visit, Huanglong, Songpan, and return transfer.',
    ],
    moments: ['Chengdu pandas', 'Jiuzhaigou lakes and waterfalls', 'Huanglong colorful travertine pools'],
    days: [
      { title: 'Day 1 - Chengdu Arrival', text: 'Arrive in Chengdu, check in, and enjoy flexible city time around local food streets, parks, or classic Chengdu neighborhoods.' },
      { title: 'Day 2 - Panda Base, Minjiang Valley & Jiuzhaigou Welcome Dinner', text: 'Visit Chengdu pandas, drive through Minjiang valley scenery, and arrive near Jiuzhaigou for a local-style welcome dinner.' },
      { title: 'Day 3 - Full-Day Jiuzhaigou National Park', text: 'Spend the day inside Jiuzhaigou, following the main valleys for lakes, waterfalls, boardwalks, forest views, and photo time.' },
      { title: 'Day 4 - Jiuzhaigou Morning, Huanglong & Qiang Village Evening', text: 'Continue toward Huanglong, cross high mountain scenery, visit the colorful pools, then enjoy a local cultural dinner or village stay.' },
      { title: 'Day 5 - Songpan or Local Morning & Return to Chengdu', text: 'Return toward Chengdu or arrange airport transfer according to the final schedule.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  6: {
    source: 'Where Yading Meets Jiuzhaigou / 亚丁遇九寨 8天7晚.pdf',
    tourCode: 'ST-SIC-8D',
    experience: [
      'A western Sichuan route from the PDF linking snow mountains, Tibetan towns, Daocheng Yading, Siguniang Mountain, pandas, Jiuzhaigou, and Huanglong.',
      'It is designed for travelers who want mountain scenery and iconic Sichuan nature in one longer route.',
    ],
    moments: ['Yuzi Xilu sunset viewpoints', 'Daocheng Yading highland trails', 'Jiuzhaigou and Huanglong finale'],
    days: [
      { title: 'Day 1 - Chengdu to Xinduqiao via highland viewpoints', text: 'Drive from Chengdu through Kangding-area scenery, Red Sea area, Sidingcuo, Yuzixi, Gedilamu, and arrive in Xinduqiao.' },
      { title: 'Day 2 - Xinduqiao, Litang & Shangri-La Town', text: 'Cross scenic mountain roads, visit Litang-area viewpoints and old-town culture, then continue toward the Yading gateway.' },
      { title: 'Day 3 - Daocheng Yading National Park', text: 'Explore Yading’s mountain landscapes with route options around Chonggu Temple, Luorong Pasture, Milk Lake, Five Color Lake, or Pearl Lake depending on pace.' },
      { title: 'Day 4 - Daocheng to Danba via Tagong & Moshi Park', text: 'Travel through Tibetan highland landscapes, photo stops, Tagong Grassland, Moshi Park, and continue to Danba.' },
      { title: 'Day 5 - Siguniang Mountain & Chengdu Area', text: 'Visit Shuangqiaogou or nearby mountain scenery before returning toward Chengdu or Dujiangyan.' },
      { title: 'Day 6 - Chengdu, Dujiangyan or Panda Valley & Jiuzhaigou', text: 'Choose Dujiangyan or Panda Valley, then drive toward Songpan and Jiuzhaigou.' },
      { title: 'Day 7 - Full-Day Jiuzhaigou', text: 'Spend the day inside Jiuzhaigou National Park for lakes, forest boardwalks, waterfalls, and valley scenery.' },
      { title: 'Day 8 - Huanglong & Return to Chengdu', text: 'Visit Huanglong Scenic Area and return via Diexi Haizi or other stops toward Chengdu.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  7: {
    source: '【全景川渝】11日游(渝进川出）.pdf',
    tourCode: 'ST-CQC-11D',
    experience: [
      'A regional Sichuan and Chongqing route combining mountain-city culture, Wulong karst, Chengdu, pandas, Jiuzhaigou, Huanglong, Emei Mountain, and Leshan.',
      'It works for travelers who want one deeper Southwest China journey instead of separate city breaks.',
    ],
    moments: ['Chongqing night views', 'Wulong karst bridges', 'Pandas, Jiuzhaigou, Emei and Leshan'],
    days: [
      { title: 'Day 1 - Arrival in Chongqing', text: 'Arrive in Chongqing and settle into the mountain city.' },
      { title: 'Day 2 - Chongqing City Highlights', text: 'Explore layered city views, local food streets, river scenery, and classic urban landmarks.' },
      { title: 'Day 3 - Wulong Karst Scenery', text: 'Travel to Wulong for karst bridges, gorges, or cave landscapes depending on the selected route.' },
      { title: 'Day 4 - Chongqing to Chengdu', text: 'Move toward Chengdu by high-speed rail or private transfer with flexible stops.' },
      { title: 'Day 5 - Chengdu Pandas & City Life', text: 'Visit pandas and experience Chengdu’s relaxed food and teahouse culture.' },
      { title: 'Day 6 - Chengdu to Jiuzhaigou Area', text: 'Drive north through valleys and mountain scenery toward Jiuzhaigou.' },
      { title: 'Day 7 - Jiuzhaigou National Park', text: 'Spend a full day inside Jiuzhaigou for lakes, waterfalls, forests, and boardwalks.' },
      { title: 'Day 8 - Huanglong Scenic Area', text: 'Visit Huanglong’s colorful pools and highland scenery.' },
      { title: 'Day 9 - Emei Mountain', text: 'Continue toward Emei for mountain scenery and Buddhist culture.' },
      { title: 'Day 10 - Leshan Giant Buddha', text: 'Visit Leshan Giant Buddha and return toward Chengdu.' },
      { title: 'Day 11 - Departure', text: 'Transfer for onward flight or train.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  8: {
    source: '重庆五日游定制行程.pdf',
    tourCode: 'ST-CQC-5D',
    experience: [
      'A Chongqing custom city route focused on layered city views, river nights, hotpot culture, and nearby karst scenery.',
      'The route can be shaped around airport pickup, railway arrival, Wulong, and flexible city time.',
    ],
    moments: ['Hongya Cave and river views', 'Mountain-city food culture', 'Wulong karst day trip'],
    days: [
      { title: 'Day 1 - Arrival in Chongqing', text: 'Pickup and transfer to the hotel with flexible evening city time.' },
      { title: 'Day 2 - Chongqing City Highlights', text: 'Explore city viewpoints, old streets, riverside landmarks, and local food culture.' },
      { title: 'Day 3 - Wulong Karst or Nature Day', text: 'Take a day trip to Wulong or another nearby scenic area depending on season and pace.' },
      { title: 'Day 4 - Culture, Neighborhoods & Night Views', text: 'Balance relaxed local neighborhoods, museums or markets, and an evening skyline experience.' },
      { title: 'Day 5 - Departure', text: 'Transfer according to the onward train or flight schedule.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  9: {
    source: '从容小团团-昆大丽6天 8人小团.pdf',
    tourCode: 'ST-YUN-6D',
    experience: [
      'A Yunnan route extracted from the PDF, connecting Kunming, Dali, Lijiang, old towns, lakeside scenery, craft experiences, and soft-paced travel.',
      'The original file emphasizes an easy group tour rhythm with airport pickup, hotel coordination, and photo-friendly stops.',
    ],
    moments: ['Kunming old city and museum time', 'Dali Xizhou and Erhai cycling', 'Lijiang and Jade Dragon Snow Mountain'],
    days: [
      { title: 'Day 1 - Kunming Arrival', text: 'Arrive in Kunming, meet the local team, transfer to the hotel, and rest or explore nearby food streets.' },
      { title: 'Day 2 - Kunming Culture, Dianchi & Chuxiong', text: 'Visit Yunnan Provincial Museum or local alternatives, Fubao Peninsula creative area, Dianchi Dam, then continue to Chuxiong.' },
      { title: 'Day 3 - Dali, Xizhou, Erhai & Local Craft Experience', text: 'Travel to Dali, visit Xizhou Ancient Town, enjoy countryside scenery, local craft time, lakeside cycling, and photo moments.' },
      { title: 'Day 4 - Dali Ancient Town, Shuanglang & Lijiang', text: 'Explore Dali Ancient Town and Shuanglang before continuing to Lijiang.' },
      { title: 'Day 5 - Jade Dragon Snow Mountain & Lijiang Area', text: 'Start early for Jade Dragon Snow Mountain scenery and continue with selected Lijiang-area experiences.' },
      { title: 'Day 6 - Kunming Departure', text: 'Return transfer and departure support according to flight timing.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  10: {
    source: '真纯玩.西双版纳5天4晚.pdf',
    tourCode: 'ST-YUN-5D',
    experience: [
      'A tropical Yunnan route from the PDF focused on Xishuangbanna nature, Dai culture, botanical gardens, villages, temples, and night markets.',
      'It is best for travelers looking for warm weather, slow culture, and rainforest atmosphere.',
    ],
    moments: ['Tropical Botanical Garden', 'Dai village culture', 'Starlight Night Market'],
    days: [
      { title: 'Day 1 - Xishuangbanna Arrival', text: 'Pickup from airport or station and hotel check-in.' },
      { title: 'Day 2 - Tropical Botanical Garden, Dai Park & Starlight Night Market', text: 'Visit the Chinese Academy of Sciences Tropical Botanical Garden, Dai cultural areas, and the evening night market.' },
      { title: 'Day 3 - Wild Elephant Valley, Manzhang Village & Prajna Temple', text: 'Explore rainforest ecology, village life, and a photogenic temple stop.' },
      { title: 'Day 4 - Mengle Great Buddhist Monastery & Manting Park', text: 'Visit a major Theravada Buddhist site and Manting Park for local history and tropical garden scenery.' },
      { title: 'Day 5 - Departure', text: 'Transfer to station or airport according to the return schedule.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  13: {
    source: '【遇见青甘】兰州起止察尔汗8天7晚大环线.pdf',
    tourCode: 'ST-NW-8D',
    experience: [
      'A northwest grand loop through Qinghai and Gansu, built around lakes, salt flats, Yardang landforms, Silk Road sites, and desert scenery.',
      'The PDF route includes Qinghai Lake, Chaka, Chakaerhan, Xitai Jinair, Mogao Caves, Mingsha Mountain, Jiayuguan, and Zhangye Danxia.',
    ],
    moments: ['Qinghai Lake and salt lakes', 'Dunhuang Mogao Caves', 'Zhangye Danxia colors'],
    days: [
      { title: 'Day 1 - Lanzhou Arrival', text: 'Arrive in Lanzhou and prepare for the northwest circuit.' },
      { title: 'Day 2 - Lanzhou to Qinghai Lake Area', text: 'Drive toward Qinghai Lake with plateau scenery and flexible photo stops.' },
      { title: 'Day 3 - Chaka or Salt Lake Landscapes', text: 'Visit Chaka Salt Lake or related salt-lake scenery depending on route timing.' },
      { title: 'Day 4 - Chakaerhan and Yardang Region', text: 'Continue through salt-lake and desert landforms for wide-open northwest scenery.' },
      { title: 'Day 5 - Dunhuang and Mogao Caves', text: 'Explore Dunhuang’s Silk Road heritage, including Mogao Caves when tickets and timing allow.' },
      { title: 'Day 6 - Mingsha Mountain and Crescent Spring', text: 'Experience desert scenery and continue toward the Hexi Corridor.' },
      { title: 'Day 7 - Jiayuguan and Zhangye Danxia', text: 'Visit Great Wall frontier culture and colorful Danxia landforms.' },
      { title: 'Day 8 - Return to Lanzhou', text: 'Return transfer or onward departure based on the final plan.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  14: {
    source: '【察尔汗7日】春夏版...pdf',
    tourCode: 'ST-NW-7D',
    experience: [
      'A seven-day Qinghai and Gansu route focused on Qinghai Lake, Chaka, Chakaerhan, Emerald Lake, Mogao Caves, Mingsha Mountain, Crescent Spring, and Rainbow Danxia.',
      'The PDF is a spring and summer group tour route with strong scenery density.',
    ],
    moments: ['Chaka and Chakaerhan salt lakes', 'Mogao Caves', 'Rainbow Danxia'],
    days: [
      { title: 'Day 1 - Arrival and Northwest Gateway', text: 'Arrive and begin the northwest route from the selected gateway city.' },
      { title: 'Day 2 - Qinghai Lake and Chaka Salt Lake', text: 'Travel through plateau scenery and visit the classic lake and salt-lake landscapes.' },
      { title: 'Day 3 - Chakaerhan and Emerald Lake', text: 'Continue to large-scale salt-lake scenery and photo-friendly color landscapes.' },
      { title: 'Day 4 - Dunhuang and Mogao Caves', text: 'Move toward Dunhuang for Silk Road culture and cave art.' },
      { title: 'Day 5 - Mingsha Mountain and Crescent Spring', text: 'Explore desert dunes and Crescent Spring with flexible timing for light and temperature.' },
      { title: 'Day 6 - Jiayuguan and Danxia', text: 'Visit frontier history and the colorful Danxia landform area.' },
      { title: 'Day 7 - Return Transfer', text: 'Return to the departure city or continue onward based on the final plan.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  15: {
    source: '[绚野伊犁]伊犁7日游.pdf',
    tourCode: 'ST-XJ-7D',
    experience: [
      'A seven-day Ili route through northern Xinjiang grasslands, lakes, forest roads, and summer scenery.',
      'The PDF emphasizes light-luxury group tour pacing, private scenic driving, and seasonal views.',
    ],
    moments: ['Ili grassland drives', 'Sayram Lake colors', 'Forest road and valley scenery'],
    days: [
      { title: 'Day 1 - Arrival in Xinjiang', text: 'Arrive and transfer to the first hotel with route briefing.' },
      { title: 'Day 2 - Sayram Lake Region', text: 'Travel toward Sayram Lake for lake, mountain, and grassland scenery.' },
      { title: 'Day 3 - Ili Valley and Flower or Grassland Stops', text: 'Continue through seasonal Ili scenery, villages, and valley roads.' },
      { title: 'Day 4 - Forest and Nature Reserve Day', text: 'Explore forested valleys or protected scenic areas depending on the selected route.' },
      { title: 'Day 5 - Nalati or Grassland Experience', text: 'Visit a major grassland area with flexible time for viewpoints and local scenery.' },
      { title: 'Day 6 - Scenic Road and Canyon Views', text: 'Drive a scenic road section with canyon or mountain viewpoints.' },
      { title: 'Day 7 - Departure', text: 'Transfer for onward train or flight.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  16: {
    source: '喀伊臻境10日游-四钻.pdf',
    tourCode: 'ST-XJ-10D',
    experience: [
      'A ten-day Xinjiang route connecting Kashgar and Ili-style scenery, with Sayram Lake, Tangbula, ancient roads, Kurdening, campfire experiences, and comfortable hotels.',
      'It suits travelers who want a broader northwestern route with scenery, culture, and road-trip rhythm.',
    ],
    moments: ['Kashgar culture', 'Sayram Lake', 'Tangbula and Kurdening landscapes'],
    days: [
      { title: 'Day 1 - Arrival in Xinjiang', text: 'Arrive and transfer to the hotel for rest and orientation.' },
      { title: 'Day 2 - Kashgar or Regional Culture', text: 'Explore local culture, markets, and old-city atmosphere where included in the selected route.' },
      { title: 'Day 3 - Scenic Transfer Day', text: 'Move across the region with planned stops and photography time.' },
      { title: 'Day 4 - Sayram Lake', text: 'Visit Sayram Lake for blue-water and mountain scenery.' },
      { title: 'Day 5 - Tangbula or Grassland Route', text: 'Continue through grasslands and valley scenery.' },
      { title: 'Day 6 - Ancient Road or Forest Valley', text: 'Drive a scenic road section and visit forest or river valley landscapes.' },
      { title: 'Day 7 - Kurdening Area', text: 'Explore Kurdening-style mountain forest scenery.' },
      { title: 'Day 8 - Campfire or Local Experience', text: 'Add a local evening experience where conditions allow.' },
      { title: 'Day 9 - Return Toward Gateway City', text: 'Return via scenic roads and flexible stops.' },
      { title: 'Day 10 - Departure', text: 'Transfer for onward flight or train.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  17: {
    source: '02华山论剑-东华4日游.pdf',
    tourCode: 'ST-XAN-4D',
    experience: [
      'A Shaanxi route from the PDF focused on Xi’an, Qin and Tang history, Terracotta Warriors, city walls, and Mount Huashan.',
      'It can be extended into a longer private route if travelers want a slower pace or extra city time.',
    ],
    moments: ['Terracotta Warriors', 'Ancient city wall', 'Mount Huashan scenery'],
    days: [
      { title: 'Day 1 - Arrival in Xi’an', text: 'Arrive in Xi’an and settle into the ancient capital.' },
      { title: 'Day 2 - Terracotta Warriors and City Culture', text: 'Visit the Terracotta Warriors and classic Xi’an city landmarks.' },
      { title: 'Day 3 - Mount Huashan', text: 'Travel to Mount Huashan for dramatic mountain views and selected cableway or trail options.' },
      { title: 'Day 4 - Departure or Extension', text: 'Transfer onward or extend the route with additional Shaanxi culture.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  18: {
    source: '藏地秘境 阿里南线7日游《可转山》.pdf',
    tourCode: 'ST-TIB-7D',
    experience: [
      'A Tibet Ali southern-line route through high plateau lakes, monasteries, ancient kingdom sites, and optional Kailash-related pacing.',
      'This route requires altitude-aware planning and careful daily timing.',
    ],
    moments: ['Yamdrok Lake', 'Guge Kingdom', 'Mapam Yumco and plateau horizons'],
    days: [
      { title: 'Day 1 - Lhasa or Gateway Arrival', text: 'Arrive and acclimatize with careful pacing.' },
      { title: 'Day 2 - Yamdrok Lake and Glacier Scenery', text: 'Begin the southern-line journey with major lake and glacier landscapes.' },
      { title: 'Day 3 - Shigatse and Monastery Culture', text: 'Visit key monastery sites and continue westward.' },
      { title: 'Day 4 - Ali Plateau Transfer', text: 'Drive through high plateau scenery with conservative timing.' },
      { title: 'Day 5 - Guge Kingdom and Sacred Lake Region', text: 'Explore Guge-related heritage and lake landscapes where route conditions allow.' },
      { title: 'Day 6 - Optional Kailash-Area Pacing', text: 'Adjust around traveler interest, altitude, and route permits.' },
      { title: 'Day 7 - Return or Onward Transfer', text: 'Transfer toward the final gateway according to the planned route.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  19: {
    source: '藏北传奇 10日游.pdf',
    tourCode: 'ST-TIB-10D',
    experience: [
      'A northern Tibet and Sichuan-Tibet route featuring Dege, Zizhu Temple, Sapu Snow Mountain, Namtso, and Lhasa.',
      'The PDF route is designed for travelers who want remote scenery and a stronger overland adventure rhythm.',
    ],
    moments: ['Dege Printing House', 'Sapu Snow Mountain', 'Namtso and Lhasa finale'],
    days: [
      { title: 'Day 1 - Arrival and Route Start', text: 'Begin the Sichuan-Tibet or northern Tibet route with arrival support.' },
      { title: 'Day 2 - Plateau Transfer and Town Stops', text: 'Drive through highland scenery toward the cultural corridor.' },
      { title: 'Day 3 - Dege Printing House', text: 'Visit Dege’s important Tibetan cultural site where included.' },
      { title: 'Day 4 - Zizhu Temple Region', text: 'Continue through mountain roads and visit dramatic monastery scenery.' },
      { title: 'Day 5 - Sapu Snow Mountain Area', text: 'Explore Sapu-area snow mountain landscapes when road and weather conditions allow.' },
      { title: 'Day 6 - Northern Tibet Grassland Road', text: 'Continue across remote plateau roads with wide-open views.' },
      { title: 'Day 7 - Namtso Region', text: 'Visit the lake region with altitude-aware timing.' },
      { title: 'Day 8 - Toward Lhasa', text: 'Travel toward Lhasa with planned rest and photo stops.' },
      { title: 'Day 9 - Lhasa Culture', text: 'Explore Lhasa’s major cultural landmarks depending on permit and time.' },
      { title: 'Day 10 - Departure', text: 'Transfer onward according to the final travel plan.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
  20: {
    source: '全景甘青8日游.pdf',
    tourCode: 'ST-NW-8P',
    experience: [
      'A panoramic Gansu-Qinghai route through lakes, salt flats, Yardang, Mogao Caves, Mingsha Mountain, Crescent Spring, Zhangye Danxia, and Qilian grassland scenery.',
      'It is a strong northwest choice for travelers who want desert, plateau, and Silk Road culture together.',
    ],
    moments: ['Qinghai Lake and Chaka', 'Mogao Caves and desert dunes', 'Zhangye Danxia and Qilian Grassland'],
    days: [
      { title: 'Day 1 - Arrival in Northwest China', text: 'Arrive in the gateway city and prepare for the Gansu-Qinghai circuit.' },
      { title: 'Day 2 - Qinghai Lake and Chaka Salt Lake', text: 'Visit plateau lake scenery and reflective salt-lake landscapes.' },
      { title: 'Day 3 - Hoh Xil or Chakaerhan Region', text: 'Continue through wide northwest landscapes and salt-lake scenery.' },
      { title: 'Day 4 - Xitai Jinair and Yardang Landforms', text: 'Explore desert-color lake and Yardang landform scenery.' },
      { title: 'Day 5 - Dunhuang and Mogao Caves', text: 'Visit Silk Road cave art and Dunhuang city.' },
      { title: 'Day 6 - Mingsha Mountain and Crescent Spring', text: 'Experience desert dunes and oasis scenery.' },
      { title: 'Day 7 - Jiayuguan and Zhangye Danxia', text: 'Visit Great Wall frontier culture and colorful Danxia landforms.' },
      { title: 'Day 8 - Qilian Grassland and Return', text: 'Return via grassland and mountain scenery toward the endpoint.' },
    ],
    included: commonIncluded,
    notes: commonNotes,
  },
};

export const getRoutePdfDetail = (id: number) => routePdfDetails[id];

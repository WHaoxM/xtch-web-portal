export const brand = {
  name: 'Syncing Travel',
  fullName: 'Syncing - Xunting Travel',
  legalName: 'Sichuan Xunting Chuhai Technology Co., Ltd.',
  chineseLegalName: '四川迅霆出海科技有限公司',
  tagline: 'Real China trips, planned by a local team',
  description:
    "Syncing Travel is a China-based inbound travel brand launched by Sichuan Xunting Chuhai Technology Co., Ltd., creating private and group tour China trips for international travelers.",
  email: 'xuntingam@syncingtravel.com',
  phone: '+86 193 8082 1961',
  phoneHref: 'tel:+8619380821961',
  whatsappHref: 'https://wa.me/8619380821961',
  website: 'https://www.xuntingtravel.com/',
  address:
    'Room 201, 2/F, Block C, Yibin Big Data Industrial Park Phase II, Guoxing Avenue, Lingang Economic Zone, Yibin, Sichuan, China',
  /** Horizontal Syncing wordmark (transparent bg) for light surfaces. */
  logoSrc: '/images/logo.png',
  /** Same horizontal lockup with light wordmark for dark surfaces. */
  logoOnDarkSrc: '/images/logo-on-dark.png',
  /** Blue S mark only (no wordmark) — footer / compact uses. */
  logoMarkSrc: '/images/logo-mark.png',
  /** Site favicon — large blue S mark (same crop as footer). */
  iconSrc: '/favicon-192.png',
};

export const guideArticles = [
  {
    slug: 'china-visa-entry-basics',
    title: 'China Visa and Entry Basics',
    eyebrow: 'Entry Planning',
    image: '/images/route-beijing-forbidden-01.png',
    summary:
      'A practical starting point for travelers checking visa-free transit, documents, arrival cities, and route timing before booking.',
    sections: [
      {
        title: 'Start with your passport and route',
        text: 'Entry rules depend on nationality, passport validity, arrival city, length of stay, and whether the trip uses visa-free transit or a standard visa. Confirm those basics before locking flights.',
      },
      {
        title: 'Keep the route realistic',
        text: 'Classic first-time routes usually work best when arrival and departure cities support the actual travel flow. Beijing, Shanghai, Chengdu, Guangzhou, and other major gateways can be combined with high-speed rail or domestic flights.',
      },
      {
        title: 'Prepare names and documents consistently',
        text: 'Use the same passport spelling across flights, hotels, train tickets, and attraction bookings. This reduces friction during ticket checks and hotel registration.',
      },
    ],
  },
  {
    slug: 'mobile-payments-in-china',
    title: 'Mobile Payments in China',
    eyebrow: 'Before You Go',
    image: '/images/route-shanghai-night-01.jpg',
    summary:
      'How international travelers should think about Alipay, WeChat Pay, backup cards, and small cash before arriving in China.',
    sections: [
      {
        title: 'Set up payment apps before arrival',
        text: 'China is highly mobile-payment oriented. Travelers should prepare Alipay or WeChat Pay in advance where possible, then keep a backup card and some cash for exceptions.',
      },
      {
        title: 'Expect local differences',
        text: 'Large cities are easier for digital payments and international cards. Smaller shops, scenic areas, and remote routes can still require flexibility.',
      },
      {
        title: 'Build support into the trip',
        text: 'Private planning helps when payments connect with tickets, transport, hotel deposits, or urgent route changes during the trip.',
      },
    ],
  },
  {
    slug: 'best-time-to-visit-china',
    title: 'Best Time to Visit China',
    eyebrow: 'Season Planning',
    image: '/images/route-qinghai-qilian-grassland-01.jpg',
    summary:
      'A seasonal planning guide for classic cities, northwest scenery, Yunnan, Sichuan, Tibet, Xinjiang, and family travel.',
    sections: [
      {
        title: 'Spring and autumn are the safest defaults',
        text: 'April to June and September to November often give comfortable walking weather for classic cities and many culture routes.',
      },
      {
        title: 'Western routes need seasonal matching',
        text: 'Xinjiang, Tibet, Qinghai, Gansu, and western Sichuan depend more on road access, altitude, temperature, and landscape timing.',
      },
      {
        title: 'Plan around crowd pressure',
        text: 'Major public holidays can affect trains, flights, hotels, and scenic areas. A private route should leave more buffer around peak periods.',
      },
    ],
  },
] as const;

export const getGuideArticleBySlug = (slug: string) =>
  guideArticles.find((article) => article.slug === slug);

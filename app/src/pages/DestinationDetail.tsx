import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, FileText, PlayCircle, Users } from 'lucide-react';
import { destinationMeta, getDestinationBySlug, getRouteTourHref, getToursByDestination } from '@/lib/contentStore';

const destinationContent: Record<
  string,
  {
    overview: string;
    whyVisit: string;
    topThings: string[];
    bestTime: string;
    tips: string[];
    videoId?: string;
  }
> = {
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

export default function DestinationDetail() {
  const { slug = '' } = useParams();
  const destination = getDestinationBySlug(slug);
  const tours = getToursByDestination(slug);
  const content = destinationContent[slug];

  if (!destination) {
    return (
      <div className="section-padding bg-white py-32">
        <div className="content-max-width max-w-3xl">
          <Link to="/destinations" className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#002A3A]">
            <ArrowLeft size={16} />
            Back to destinations
          </Link>
          <h1 className="mt-8 font-serif text-[42px] leading-tight text-[#002A3A]">
            Destination not found
          </h1>
          <p className="mt-4 text-[15px] leading-8 text-[#5D5D5D]">
            This destination is not in the current real route library.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-[#002A3A] section-padding">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${destination.image})` }}
        />
        <div className="absolute inset-0 bg-[#002A3A]/55" />
        <div className="relative z-10 flex min-h-[80vh] w-full items-center justify-center pt-28 text-center">
          <div className="mx-auto max-w-[1060px] py-14 text-white">
            <Link
              to="/destinations"
              className="mb-8 inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/82 transition-colors hover:text-white"
            >
              <ArrowLeft size={15} />
              All destinations
            </Link>
            <p className="mb-4 font-condensed text-[28px] uppercase tracking-[0.08em] text-white">
              {destination.name}
            </p>
            <h1 className="tocn-hero-title text-white">
              {destination.name} Private Tours & Travel Guide
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-[16px] leading-8 text-white/88">
              {destination.description}
            </p>
          </div>
        </div>
      </section>

      {content?.videoId && (
        <section className="bg-white py-16 section-padding md:py-20">
          <div className="tocn-wide grid grid-cols-1 gap-8 lg:grid-cols-[0.45fr_0.55fr] lg:items-center">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.16em] text-[#379C8A]">
                <PlayCircle size={17} />
                Watch Before You Plan
              </p>
              <h2 className="tocn-section-title text-[#002A3A]">
                {destination.name} Travel Highlights
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-8 text-[#5D5D5D]">
                Video gives travelers a faster sense of scale, crowd rhythm, scenery, and walking
                time before they compare route files or request a custom plan.
              </p>
            </div>
            <div className="overflow-hidden rounded-[10px] bg-[#061417] shadow-[0_24px_70px_rgba(0,42,58,0.18)]">
              <div className="aspect-video">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${content.videoId}`}
                  title={`${destination.name} travel highlights`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-white py-16 section-padding md:py-20">
        <div className="tocn-wide">
          <div className="mb-8 text-center">
            <h2 className="tocn-section-title text-[#002A3A]">Popular {destination.name} Tours</h2>
            <p className="mx-auto mt-3 max-w-3xl text-[15px] leading-8 text-[#5D5D5D]">
              Start with a real route file for {destination.name}, then customize the pace, hotel
              level, guide needs, and timing.
            </p>
          </div>

          {tours.length > 0 ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
              {tours.map((tour) => {
                const href = `#${getRouteTourHref(tour)}`;
                return (
                  <a
                    key={tour.slug}
                    href={href}
                    className="tocn-image-card group block"
                  >
                    <div className="overflow-hidden rounded-[30px] bg-[#d7d7d7]">
                      <img
                        src={tour.image}
                        alt={tour.title}
                        className="h-[350px] w-full object-cover md:h-[450px]"
                      />
                    </div>
                    <div className="tocn-floating-panel relative z-10 bg-white px-5 py-5 text-center shadow-[0_12px_35px_rgba(0,0,0,0.16)]">
                      <h3 className="font-serif text-[23px] leading-tight text-[#002A3A]">
                        {tour.title}
                      </h3>
                      <p className="mt-4 line-clamp-4 text-[14px] leading-7 text-[#5D5D5D]">
                        {tour.desc}
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-4 text-[12px] text-[#88929C]">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} />
                          {tour.duration}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} />
                          {tour.groupSize}
                        </span>
                      </div>
                      <span className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#002A3A] px-5 py-2.5 text-[13px] font-semibold text-white">
                        <FileText size={14} />
                        View route details
                        <ArrowRight size={14} />
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="tocn-card rounded-[12px] bg-white p-8 text-center">
              <h3 className="font-serif text-[28px] text-[#002A3A]">No route file listed yet</h3>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-8 text-[#5D5D5D]">
                This destination exists in the route coverage, but no public route card is currently
                attached.
              </p>
            </div>
          )}
        </div>
      </section>

      {content && (
        <>
          <section className="bg-[#F9F9F9] py-16 section-padding md:py-20">
            <div className="tocn-wide grid grid-cols-1 gap-10 lg:grid-cols-[0.4fr_0.6fr] lg:items-center">
              <div>
                <h2 className="tocn-section-title text-[#002A3A]">
                  {destination.name} Overview
                </h2>
              </div>
              <div className="tocn-card rounded-[12px] bg-white p-7 text-[16px] leading-8 text-[#5D5D5D] md:p-9">
                <p>{content.overview}</p>
              </div>
            </div>
          </section>

          <section className="bg-white py-16 section-padding md:py-20">
            <div className="tocn-wide grid grid-cols-1 gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:items-start">
              <div>
                <h2 className="tocn-section-title text-[#002A3A]">Why Visit {destination.name}</h2>
              </div>
              <div className="text-[18px] font-semibold uppercase leading-9 text-[#379C8A]">
                {content.whyVisit}
              </div>
            </div>
          </section>

          <section className="bg-[#F9F9F9] py-16 section-padding md:py-20">
            <div className="tocn-wide">
              <div className="mb-10 text-center">
                <h2 className="tocn-section-title text-[#002A3A]">Top Things to Do in {destination.name}</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {content.topThings.map((item, index) => (
                  <article key={item} className="tocn-card rounded-[12px] bg-white p-6">
                    <p className="font-condensed text-[28px] leading-none tracking-[0.06em] text-[#379C8A]">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className="mt-5 font-serif text-[23px] leading-tight text-[#002A3A]">{item}</h3>
                    <p className="mt-4 text-[14px] leading-7 text-[#5D5D5D]">
                      {destination.name} works best when this stop has enough time in the daily
                      route instead of being rushed as a checklist item.
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white py-16 section-padding md:py-20">
            <div className="tocn-wide">
              <div className="mb-10 text-center">
                <h2 className="tocn-section-title text-[#002A3A]">Best Time to Visit {destination.name}</h2>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {[
                  ['Spring', content.bestTime],
                  ['Summer', `${destination.name} can be lively in summer, but timing, heat, and scenic-area crowds need more planning.`],
                  ['Autumn', 'Autumn is often one of the strongest seasons for comfortable sightseeing and clearer photography conditions.'],
                  ['Winter', 'Winter is quieter and can work well for travelers who prefer fewer crowds and do not mind colder weather.'],
                ].map(([season, text], index) => (
                  <article
                    key={season}
                    className="tocn-card rounded-[12px] bg-[#F9F9FB] p-6 md:p-7"
                  >
                    <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#379C8A]">
                      Season {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className="mt-4 font-serif text-[24px] leading-tight text-[#002A3A]">
                      {season} in {destination.name}
                    </h3>
                    <p className="mt-4 text-[14px] leading-7 text-[#5D5D5D]">{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-[#F9F9F9] py-16 section-padding md:py-20">
            <div className="tocn-wide grid grid-cols-1 gap-10 lg:grid-cols-[0.36fr_0.64fr]">
              <div>
                <h2 className="tocn-section-title text-[#002A3A]">{destination.name} Travel Tips</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {content.tips.map((tip, index) => (
                  <div key={tip} className="tocn-card rounded-[12px] bg-white p-6">
                    <p className="font-condensed text-[25px] leading-none tracking-[0.06em] text-[#379C8A]">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className="mt-4 text-[18px] font-semibold leading-snug text-[#002A3A]">
                      {tip}
                    </h3>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <section className="bg-white py-14 section-padding">
        <div className="tocn-wide">
          <div className="tocn-card rounded-[12px] bg-[#F9F9F9] p-7 md:p-9">
            <p className="font-condensed text-[24px] uppercase tracking-[0.08em] text-[#379C8A]">
              More real destinations
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {destinationMeta
                .filter((item) => item.slug !== destination.slug)
                .map((item) => (
                  <Link
                    key={item.slug}
                    to={`/destinations/${item.slug}`}
                    className="rounded-full border border-[#D6D6D6] bg-white px-4 py-2 text-[13px] font-semibold text-[#002A3A] transition-colors hover:bg-[#F6FAFE]"
                  >
                    {item.name}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

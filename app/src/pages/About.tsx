import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { brand } from '@/lib/siteData';

// Office photos from syncingtravel.com/page-1 (ABOUT US); CTA uses existing route asset.
const aboutHeroImages = {
  companyLogoWall: '/images/about-logo-wall.jpg',
  officeWorkspace: '/images/about-office-workspace.jpg',
  westernSichuanCta: '/images/route-sichuan-yading.jpg',
};

const teamCards = [
  {
    title: 'Tour Guide Team',
    image:
      'https://static.wixstatic.com/media/2c1368_888a6d2c200142599a95f3ee82210b78~mv2.png/v1/fill/w_1558,h_881,al_c,q_90,enc_auto/2c1368_888a6d2c200142599a95f3ee82210b78~mv2.png',
    text: "Our multilingual tour guide team are passionate experts in China's culture and landscapes. They provide immersive, engaging commentary and personalized on-site support, bringing every destination to life for international travelers.",
  },
  {
    title: 'Travel Consultancy Team',
    image:
      'https://static.wixstatic.com/media/2c1368_f68e33e924d046a9bce4af2df8ba2e34~mv2.png/v1/fill/w_1578,h_866,al_c,q_90,enc_auto/2c1368_f68e33e924d046a9bce4af2df8ba2e34~mv2.png',
    text: 'Our dedicated consultants provide end-to-end support for your journey. From initial inquiries and itinerary planning to booking confirmations and travel tips, they are your reliable English-speaking partners for a smooth and stress-free experience.',
  },
  {
    title: 'Itinerary Design Team',
    image:
      'https://static.wixstatic.com/media/2c1368_4a05663e8e7d409e9dfc83044dd09ccc~mv2.png/v1/fill/w_1532,h_887,al_c,q_90,enc_auto/2c1368_4a05663e8e7d409e9dfc83044dd09ccc~mv2.png',
    text: 'Our creative itinerary designers craft unique, off-the-beaten-path travel experiences tailored for international visitors. They combine iconic sights with hidden gems, ensuring your trip balances adventure, culture, and comfort.',
  },
];

const chooseItems = [
  {
    title: 'Professional & Personalized Service',
    text: 'From the first message to the final travel day, we shape each plan around your pace, interests, and comfort level.',
  },
  {
    title: 'In-Depth Local Exploration',
    text: 'We help you move beyond crowded stops with private pacing, local context, and routes that still feel relaxed.',
  },
  {
    title: 'Supportive & Attentive Guidance',
    text: 'Our team keeps communication clear before and during the trip, so you can focus on discovery.',
  },
];

const aboutStats = [
  {
    value: '60K +',
    label: 'Guests Served Worldwide',
  },
  {
    value: '50 +',
    label: 'Countries Served Worldwide',
  },
  {
    value: '100 %',
    label: 'China-Based Expert Team',
  },
  {
    value: '15 Years',
    label: 'Deep China Expertise',
  },
];

export default function About() {
  useScrollAnimation('.about-replica-anim');

  return (
    <div className="bg-white text-[#3f4850]">
      <section className="border-t-[14px] border-[#c8b5ff] bg-white px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-16 xl:px-16 xl:pb-36">
        <div className="mx-auto grid max-w-[1860px] grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center xl:gap-18">
          <div className="about-replica-anim animate-fade-up max-w-[760px] lg:pl-8 xl:pl-12">
            <h1 className="font-condensed max-w-[760px] text-[42px] font-bold leading-[0.86] tracking-normal text-[#36393c] md:text-[66px] xl:text-[82px]">
              Explore Infinite Travel Possibilities,
              <br />
              Meet the World's Most Beautiful Souls.
            </h1>
            <p className="mt-9 max-w-[760px] text-[18px] leading-8 text-[#3f4850] md:text-[25px] md:leading-[1.36] xl:text-[30px]">
              {brand.name}, the travel brand of {brand.legalName}, is committed to creating
              thoughtful private China journeys for international travelers. We do not only arrange
              destinations. We help you travel with clarity, care, and a pace that feels your own.
            </p>
          </div>

          <div className="about-replica-anim animate-fade-up grid gap-3">
            <img
              src={aboutHeroImages.companyLogoWall}
              alt="Syncing Travel office logo wall"
              className="h-[250px] w-full rounded-[22px] object-cover object-center md:h-[430px] xl:h-[452px]"
            />
            <img
              src={aboutHeroImages.officeWorkspace}
              alt="Syncing Travel office workspace"
              className="h-[250px] w-full rounded-[22px] object-cover object-center md:h-[430px] xl:h-[452px]"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#fbfbfb] px-6 py-20 text-center md:px-10 md:py-32 xl:py-40">
        <div className="about-replica-anim animate-fade-up mx-auto max-w-[1500px]">
          <p className="text-[15px] font-semibold uppercase tracking-[0.34em] text-[#786076] md:text-[24px]">
            Our Mission &amp; Vision
          </p>
          <h2 className="mt-5 font-serif text-[36px] font-normal leading-snug text-[#55585b] md:text-[58px] xl:text-[68px]">
            In the Name of Nature, Embark on a Grand Journey of the Soul
          </h2>
          <p className="mx-auto mt-12 max-w-[1360px] text-[18px] leading-8 text-[#888a98] md:text-[30px] md:leading-[1.45]">
            We strive to make private travel feel calm, personal, and deeply connected to place.
            Through careful planning and local insight, we create China itineraries that balance
            iconic sights, hidden moments, comfort, and meaningful discovery.
          </p>
        </div>
      </section>

      <section className="bg-[#f5fafc] px-6 py-14 md:px-10 md:py-20 xl:px-20">
        <div className="about-replica-anim animate-fade-up mx-auto grid max-w-[1500px] grid-cols-1 gap-y-8 text-center sm:grid-cols-2 md:gap-y-10 lg:grid-cols-4">
          {aboutStats.map((stat, index) => (
            <div
              key={stat.label}
              className="px-4 sm:px-8 lg:border-l lg:border-[#d4dde3] first:lg:border-l-0 xl:px-12"
              style={{ transitionDelay: `${index * 0.04}s` }}
            >
              <p className="font-sans text-[46px] font-semibold leading-none tracking-normal text-black md:text-[58px] xl:text-[68px]">
                {stat.value}
              </p>
              <p className="mt-5 font-mono text-[17px] font-medium leading-snug tracking-normal text-[#183b4a] md:text-[20px] xl:text-[22px]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white px-6 pb-14 md:px-10 md:pb-24 xl:px-20 xl:pb-28">
        <div className="mx-auto max-w-[1740px]">
          <div className="about-replica-anim animate-fade-up border-b border-[#6d7478] pb-6 md:pb-8">
            <h2 className="font-serif text-[46px] font-normal leading-none text-[#4d4d4d] md:text-[82px] xl:text-[92px]">
              Our Travel Experts
            </h2>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 min-[700px]:mt-10 min-[700px]:grid-cols-3 min-[700px]:gap-5 lg:gap-7">
            {teamCards.map((card, index) => (
              <article
                key={card.title}
                className="about-replica-anim animate-fade-up rounded-[16px] border border-[#d5dde2] bg-[#f8fbfd] p-3 text-left min-[700px]:p-4"
                style={{ transitionDelay: `${index * 0.06}s` }}
              >
                <img
                  src={card.image}
                  alt={card.title}
                  className="h-[150px] w-full rounded-[12px] border border-[#c8dde7] object-cover object-center min-[700px]:h-[145px] lg:h-[190px] xl:h-[220px]"
                />
                <div className="px-1 pb-2 pt-4 min-[700px]:px-0">
                  <h3 className="font-serif text-[24px] font-normal leading-tight text-[#4f5960] min-[700px]:text-[22px] lg:text-[28px]">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-[#66717a] min-[700px]:text-[14px] min-[700px]:leading-6 lg:text-[16px] lg:leading-7">
                    {card.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 pb-18 md:px-10 md:pb-24 xl:px-20 xl:pb-28">
        <div className="mx-auto max-w-[1640px]">
          <div className="about-replica-anim animate-fade-up border-b border-[#8f9498] pb-3">
            <h2 className="font-serif text-[48px] font-normal leading-none text-[#4d4d4d] md:text-[86px] xl:text-[104px]">
              Why Choose Us
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-10 md:mt-24 md:grid-cols-3 md:gap-24 xl:gap-34">
            {chooseItems.map((item, index) => (
              <article
                key={item.title}
                className="about-replica-anim animate-fade-up"
                style={{ transitionDelay: `${index * 0.06}s` }}
              >
                <h3 className="font-serif text-[20px] font-semibold text-[#4f555a] md:text-[28px]">
                  {item.title}
                </h3>
                <p className="mt-6 text-[17px] leading-8 text-[#5f686f] md:text-[28px] md:leading-[1.36]">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-final-cta">
        <img
          src={aboutHeroImages.westernSichuanCta}
          alt="Snow mountain valley landscape in Western Sichuan"
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

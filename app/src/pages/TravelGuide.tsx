import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SectionIntro } from '@/components/SiteSections';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { guideArticles } from '@/lib/siteData';

const guideTopics = [
  { icon: 'M2 12h20M2 12l4-4m-4 4l4 4M22 12l-4-4m4 4l-4 4M12 2v20M12 2l-4 4M12 2l4 4', title: 'Visa & Entry Requirements', desc: 'Most nationalities need a Chinese visa. Learn about the application process, 144-hour visa-free transit, and the latest policy updates.' },
  { icon: 'M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h4v4H7V7zm0 6h4v4H7v-4zm6-6h4v4h-4V7zm0 6h4v4h-4v-4z', title: 'Payments in China', desc: 'China is largely cashless. Set up Alipay or WeChat Pay before arrival, and keep some cash as backup for small shops.' },
  { icon: 'M4 16v-2h2v2H4zm0 4v-2h2v2H4zm2-8V8h12v4H6zm2-6V2h8v4H8zm10 16H8v-4h10v4zm2-6h-2v-2h2v2zm0 4h-2v-2h2v2z', title: 'Getting Around', desc: "China's high-speed rail network is world-class. Book tickets in advance and use DiDi for city transport." },
  { icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z', title: 'Internet & Connectivity', desc: 'Get a local SIM or eSIM for reliable internet. VPN is recommended for accessing Google, WhatsApp and Western social media.' },
  { icon: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3.5V2h-2v3.5h-2V2h-2v5c0 1.65 1.35 3 3 3h1v7h2v-7h1c1.65 0 3-1.35 3-3V2h-2v3.5h-2z', title: 'Food & Dining', desc: 'From street food to Michelin-starred restaurants, Chinese cuisine is incredibly diverse. Learn about regional specialties.' },
  { icon: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z', title: 'Best Time to Visit', desc: 'Spring (Apr-Jun) and autumn (Sep-Nov) are ideal. Avoid Golden Week (early Oct) and Chinese New Year for fewer crowds.' },
  { icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z', title: 'Health & Safety', desc: 'China is very safe for travelers. Bring any prescription medications and consider travel insurance for peace of mind.' },
];

export default function TravelGuide() {
  useScrollAnimation('.guide-anim');

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[55vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/images/hero-bambooraft.jpg)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-[#002A3A]/52 to-black/78" />
        <div className="hero-copy-shadow relative z-10 text-center text-white px-6 pt-24">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white mb-4">Travel Guide</p>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-[64px] mb-4 leading-[1.1]">China Travel Guide</h1>
          <p className="text-[15px] text-white max-w-3xl mx-auto leading-relaxed">
            Start here for the essentials — entry basics, mobile payments, and how to get around China smoothly.
          </p>
        </div>
      </section>

      {/* Intro */}
      <section className="bg-white py-14 section-padding">
        <div className="content-max-width max-w-3xl text-center">
          <h2 className="font-sans text-xl md:text-2xl text-[#002A3A] mb-4 font-light uppercase tracking-wide">
            Essential Tips for Traveling in China
          </h2>
          <p className="text-[#5D5D5D] text-[15px] leading-[1.8]">
            This guide hub helps you plan a smooth trip to China — from visas and mobile payments to
            transportation, city highlights, and itinerary ideas.
          </p>
        </div>
      </section>

      {/* Topic Guides */}
      <section className="bg-[#F6FAFE] py-16 md:py-20 section-padding">
        <div className="content-max-width">
          <div className="text-center mb-10 guide-anim animate-fade-up">
            <h2 className="font-serif text-2xl md:text-3xl text-[#002A3A] mb-2">Practical Travel Topics</h2>
            <p className="text-[#5D5D5D] text-[14px]">Everything you need to know before your trip</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {guideTopics.map((topic, i) => (
              <div key={topic.title} className="guide-anim animate-fade-up bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 border border-[#D6D6D6] group" style={{ transitionDelay: `${(i % 3) * 0.08}s` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#379C8A" strokeWidth="1.5" className="mb-4"><path d={topic.icon} /></svg>
                <h3 className="font-sans text-[16px] text-[#002A3A] mb-2 font-semibold">{topic.title}</h3>
                <p className="text-[#5D5D5D] text-[14px] leading-7">{topic.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20 section-padding">
        <div className="tocn-wide">
          <SectionIntro
            eyebrow="Planning Articles"
            title="Detailed notes before you book"
            text="Use these short planning guides before choosing route length, arrival cities, transport, and seasonal timing."
          />
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {guideArticles.map((article) => (
              <Link
                key={article.slug}
                to={`/travel-guide/${article.slug}`}
                className="tocn-image-card group block"
              >
                <div className="overflow-hidden rounded-[8px]">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="h-[340px] w-full object-cover"
                  />
                </div>
                <div className="tocn-floating-panel relative z-10 bg-white px-5 py-5 text-center shadow-[0_12px_35px_rgba(0,0,0,0.16)]">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#379C8A]">
                    {article.eyebrow}
                  </p>
                  <h3 className="font-serif text-[23px] leading-tight text-[#002A3A]">
                    {article.title}
                  </h3>
                  <p className="mt-4 line-clamp-4 text-[14px] leading-7 text-[#5D5D5D]">
                    {article.summary}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#002A3A]">
                    Read guide
                    <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, Car, Ticket, Users } from 'lucide-react';
import { CtaBand, FaqBlock, PageHero, SectionIntro } from '@/components/SiteSections';

const costDrivers = [
  {
    Icon: Users,
    title: 'Group size',
    text: 'Private vehicle, guide, and room arrangements change significantly between couples, families, and group travelers.',
  },
  {
    Icon: BedDouble,
    title: 'Hotel level',
    text: 'Comfort, premium, and luxury hotels can shift the final quote more than most sightseeing items.',
  },
  {
    Icon: Car,
    title: 'Transport flow',
    text: 'High-speed rail, domestic flights, private drivers, airport transfers, and long scenic drives all affect the budget.',
  },
  {
    Icon: Ticket,
    title: 'Guide and tickets',
    text: 'Major attractions, private guides, scenic shuttles, and timed-entry bookings should be planned before quoting.',
  },
];

const sampleBudgets = [
  {
    title: 'Classic city route',
    range: 'Usually quoted after dates',
    text: 'Best for Beijing, Shanghai, Xi’an, Chengdu, or short city combinations with guides and selected transfers.',
  },
  {
    title: 'Nature and regional route',
    range: 'Depends on transport distance',
    text: 'Best for Sichuan, Yunnan, Guangxi, Chongqing, and mixed city-plus-scenery routes.',
  },
  {
    title: 'Northwest or plateau route',
    range: 'Season and vehicle sensitive',
    text: 'Best for Qinghai, Gansu, Xinjiang, Tibet, and long-distance scenic loops with more logistics.',
  },
];

const faqs = [
  {
    question: 'Why is there no fixed public price?',
    answer:
      'Private China tour cost depends on dates, cities, hotel level, group size, vehicle type, guide needs, flights or trains, and attraction tickets.',
  },
  {
    question: 'Can I control the budget?',
    answer:
      'Yes. The quickest levers are hotel level, route length, number of cities, guide days, and whether transfers use flights, trains, or private vehicles.',
  },
  {
    question: 'What should I send for a quote?',
    answer:
      'Share travel month, number of travelers, target cities, trip length, hotel level, and any route PDF or destination page you like.',
  },
];

export default function TourCost() {
  return (
    <div className="bg-white">
      <PageHero
        eyebrow="China Private Tour Cost"
        title="How much should you budget for a private China trip?"
        text="A useful quote starts with route shape, dates, traveler count, hotel level, and the kind of support you want on the road."
        image="/images/route-guilin.jpg"
        align="left"
      >
        <Link
          to="/custom-trip"
          className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[6px] bg-white px-8 text-[15px] font-semibold text-[#002A3A] hover:bg-[#F6FAFE]"
        >
          Request a Quote
          <ArrowRight size={17} />
        </Link>
      </PageHero>

      <section className="section-padding bg-white py-16 md:py-20">
        <div className="tocn-wide grid grid-cols-1 gap-10 lg:grid-cols-[0.38fr_0.62fr]">
          <SectionIntro eyebrow="Cost Logic" title="What changes the quote" align="left" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {costDrivers.map(({ Icon, title, text }) => (
              <article key={title} className="tocn-card bg-[#F9F9FB] p-7">
                <Icon size={22} className="mb-5 text-[#379C8A]" />
                <h2 className="text-[20px] font-semibold text-[#002A3A]">{title}</h2>
                <p className="mt-3 text-[14px] leading-7 text-[#5D5D5D]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-[#061417] py-16 md:py-20">
        <div className="tocn-wide">
          <SectionIntro
            eyebrow="Budget Examples"
            title="Use route type before exact numbers"
            text="These examples help frame the conversation. Final pricing should be quoted against real dates, hotel preference, and logistics."
            inverted
          />
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {sampleBudgets.map((item, index) => (
              <article key={item.title} className="rounded-[8px] border border-white/12 bg-white/[0.075] p-7 text-white">
                <p className="font-condensed text-[32px] leading-none tracking-[0.06em] text-[#6FD1D7]">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-5 text-[22px] font-semibold leading-tight text-white">{item.title}</h2>
                <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.12em] text-[#6FD1D7]">
                  {item.range}
                </p>
                <p className="mt-4 text-[14px] leading-7 text-white/72">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-[#F9F9F9] py-16 md:py-20">
        <div className="tocn-wide grid grid-cols-1 gap-10 lg:grid-cols-[0.46fr_0.54fr] lg:items-center">
          <div className="overflow-hidden rounded-[8px]">
            <img src="/images/route-qinggan-saltlake.jpg" alt="Northwest China route planning" className="h-[520px] w-full object-cover" />
          </div>
          <div>
            <SectionIntro eyebrow="Quote Checklist" title="Send these details first" align="left" />
            <div className="mt-8 space-y-4">
              {[
                'Travel month or exact dates',
                'Number of travelers and room arrangement',
                'Cities or route PDFs you like',
                'Preferred hotel level',
                'Guide, driver, train, or flight expectations',
                'Special interests, dietary needs, walking pace, or family requirements',
              ].map((item) => (
                <div key={item} className="border-t border-[#D6D6D6] pt-4 text-[16px] font-semibold text-[#002A3A]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white py-16 md:py-20">
        <SectionIntro eyebrow="FAQ" title="Private China tour cost questions" />
        <div className="mt-10">
          <FaqBlock items={faqs} />
        </div>
      </section>

      <CtaBand
        eyebrow="Get a Real Quote"
        title="Pricing works best after the route is shaped"
        text="Send the basics and the Syncing team can help turn the right route into a practical private-trip quote."
        primaryTo="/custom-trip"
        secondaryTo="/china-tours"
        secondaryLabel="Browse Routes"
      />
    </div>
  );
}

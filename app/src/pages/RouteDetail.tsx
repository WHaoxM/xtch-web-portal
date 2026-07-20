import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  CircleX,
  HelpCircle,
  Image as ImageIcon,
  MessageCircle,
  Plane,
  ShieldCheck,
  Ticket,
  TrainFront,
  Utensils,
  Users,
} from 'lucide-react';
import { getDestinationBySlug, getRouteTourBySlug } from '@/lib/contentStore';
import { GroupTourInquiryModal, PrivateQuoteModal } from '@/components/RouteInquiryModals';
import { getRoutePdfDetail, type RoutePdfDetail } from '@/lib/routePdfDetails';
import { routeGenericFaqs } from '@/lib/seo/faqPacks';

const includedItems = [
  { Icon: BedDouble, label: 'Accommodation' },
  { Icon: Users, label: 'Guide' },
  { Icon: ShieldCheck, label: 'Additional Services' },
  { Icon: Car, label: 'Transportation' },
  { Icon: Utensils, label: 'Meals' },
  { Icon: Ticket, label: 'Attraction Entrance Tickets' },
  { Icon: ShieldCheck, label: 'Travel Insurance' },
];

const notIncludedItems = [
  'International Transportation',
  'Visa',
  'International travel insurance',
  'Optional Activities',
  'Personal Expenses',
  'Tipping',
];

const wayCards = [
  {
    Icon: CalendarDays,
    title: 'Travel Style Options',
    text: 'Private or group tour travel can be arranged depending on your dates and pace.',
  },
  {
    Icon: BedDouble,
    title: 'Selected Hotels',
    text: 'Hotel level can be adjusted around comfort, location, and budget.',
  },
  {
    Icon: Utensils,
    title: 'Breakfast Included',
    text: 'Daily rhythm stays simple, with flexible lunch and dinner choices.',
  },
  {
    Icon: Car,
    title: 'Smooth Transportation',
    text: 'Transfers, trains, flights, and local transport are coordinated around the route.',
  },
  {
    Icon: ImageIcon,
    title: 'Entrance Tickets',
    text: 'Main attractions can be arranged in advance for a smoother travel day.',
  },
  {
    Icon: Users,
    title: 'Local English-Speaking Guides',
    text: 'Professional local guides help make each destination easier to understand.',
  },
];

const fallbackGallery = [
  '/images/route-beijing-forbidden-01.png',
  '/images/route-beijing-greatwall-01.png',
  '/images/route-xian-warriors-01.jpg',
  '/images/route-shanghai-night-01.jpg',
];

export default function RouteDetail() {
  const { slug = '' } = useParams();
  const tour = getRouteTourBySlug(slug);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [privateModalOpen, setPrivateModalOpen] = useState(false);

  if (!tour) {
    return (
      <div className="section-padding bg-white py-32" data-seo-content="missing">
        <div className="content-max-width max-w-3xl">
          <Link
            to="/china-trips"
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#002A3A]"
          >
            <ArrowLeft size={16} />
            Back to tours
          </Link>
          <h1 className="mt-8 font-serif text-[42px] leading-tight text-[#002A3A]">
            Route not found
          </h1>
          <p className="mt-4 text-[15px] leading-8 text-[#5D5D5D]">
            This route is not available in the current Syncing Travel route library.
          </p>
        </div>
      </div>
    );
  }

  const pdfDetail = tour.structuredItinerary
    ? buildStructuredDetail(tour, tour.structuredItinerary)
    : getRoutePdfDetail(tour.id) ?? buildFallbackDetail(tour);
  const gallery = buildGallery(tour);
  const highlights = buildHighlights(pdfDetail, tour.title);

  return (
    <div className="bg-white text-[#002A3A]">
      <section className="relative min-h-[760px] overflow-hidden bg-[#061417]">
        <img src={tour.image} alt={tour.title} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,20,28,0.66),rgba(0,20,28,0.52)),linear-gradient(180deg,rgba(0,0,0,0.66),rgba(0,0,0,0.22)_38%,rgba(0,0,0,0.52))]" />
        <div className="relative mx-auto flex min-h-[760px] max-w-[1320px] flex-col items-center justify-center px-6 pt-24 text-center">
          <h1 className="max-w-[980px] font-serif text-[48px] font-medium leading-[1.18] text-white md:text-[76px]">
            {tour.title}
          </h1>
          <div className="mt-14 flex items-center gap-2 text-[15px] font-semibold text-white/88">
            <Link to="/" className="text-white/88">
              Home
            </Link>
            <span className="text-white/75">»</span>
            <Link to="/china-trips" className="text-white/88">
              China Tours
            </Link>
          </div>
        </div>
      </section>

      <nav className="sticky top-24 z-30 rounded-b-[10px] bg-white shadow-[0_12px_34px_rgba(0,0,0,0.08)]">
        <div className="mx-auto grid max-w-[1320px] grid-cols-4 text-center">
          {[
            ['Itinerary', '#itinerary'],
            ['Included', '#included'],
            ['FAQ', '#faq'],
            ['Price', '#price'],
          ].map(([label, href]) => (
            <a key={label} href={href} className="py-7 text-[18px] font-medium text-[#111]">
              {label}
            </a>
          ))}
        </div>
      </nav>

      <section className="px-6 py-12 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1280px]">
          <p className="text-[22px] font-medium tracking-[0.06em] text-[#0d4151]">
            Tour Code: {pdfDetail.tourCode}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3 text-[16px] font-semibold uppercase tracking-[0.12em] text-[#74839a]">
            <span>Tour Type:</span>
            <span className="normal-case tracking-normal">Group tour</span>
            <span className="normal-case tracking-normal">Private</span>
          </div>
        </div>
      </section>

      <section className="px-6 pb-12 md:px-10 md:pb-24">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-14 lg:grid-cols-[0.48fr_0.52fr]">
          <div className="relative mx-auto min-h-[360px] w-full max-w-[340px] md:min-h-[480px] md:max-w-[540px]">
            <img
              src={gallery[2] ?? gallery[0]}
              alt=""
              className="absolute left-4 top-0 h-[250px] w-[230px] rounded-[6px] object-cover opacity-95 shadow-[0_10px_30px_rgba(0,0,0,0.12)] md:left-8 md:h-[360px] md:w-[330px]"
            />
            <img
              src={gallery[1] ?? gallery[0]}
              alt=""
              className="absolute bottom-0 right-2 h-[250px] w-[230px] rounded-[3px] border-[8px] border-white object-cover shadow-[0_12px_34px_rgba(0,0,0,0.14)] md:right-0 md:h-[360px] md:w-[330px] md:border-[10px]"
            />
          </div>
          <div>
            <h2 className="font-serif text-[42px] font-medium leading-tight text-[#042f3a] md:text-[54px]">
              {tour.title} Highlights
            </h2>
            <div className="mt-8 divide-y divide-[#edf0ef]">
              {highlights.map((item) => (
                <div key={item} className="flex gap-5 py-5 text-[17px] leading-8 text-[#566168]">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#65baa9] text-[#2a9f8b]">
                    <Check size={15} />
                  </span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#06333d] bg-[linear-gradient(rgba(0,44,55,0.82),rgba(0,44,55,0.82)),url('/images/ref-banner-misty-river.jpg')] bg-cover bg-center px-6 py-10 text-white md:px-10">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 md:grid-cols-4">
          {[
            ['LOCAL TRAVEL EXPERTS', 'Real on-the-ground insight'],
            ['TOUR OPTIONS AVAILABLE', 'Private or group tour'],
            ['ALL TRANSFERS INCLUDED', 'Smooth transfers throughout'],
            ['LICENSED LOCAL GUIDES', 'Professional English-speaking'],
          ].map(([title, text]) => (
            <div key={title} className="border border-white/14 px-8 py-7 text-center">
              <p className="font-bold tracking-[0.08em]">{title}</p>
              <p className="mt-3 font-serif text-[18px] italic text-white/82">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-14 md:px-10 md:py-28">
        <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-14 lg:grid-cols-[1fr_360px]">
          <main>
            <section>
              <h2 className="text-center font-serif text-[42px] font-medium text-[#073846] md:text-[54px]">
                The Way You Travel With Us
              </h2>
              <div className="mt-12 grid grid-cols-1 gap-7 md:grid-cols-3">
                {wayCards.map(({ Icon, title, text }) => (
                  <article key={title} className="min-h-[300px] rounded-[8px] border border-[#edf0ef] bg-white p-8">
                    <span className="flex h-12 w-12 items-center justify-center rounded-[6px] bg-[#35a895] text-white">
                      <Icon size={24} />
                    </span>
                    <h3 className="mt-8 text-[20px] font-bold text-[#002A3A]">{title}</h3>
                    <p className="mt-4 text-[16px] leading-8 text-[#58646a]">{text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-24">
              <h2 className="text-center font-serif text-[42px] font-medium text-[#073846] md:text-[54px]">
                Signature Moments Along the Journey
              </h2>
              <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
                {gallery.slice(0, 3).map((image) => (
                  <img key={image} src={image} alt="" className="h-[320px] w-full rounded-[16px] object-cover" />
                ))}
              </div>
            </section>

            <section id="itinerary" className="mt-28 scroll-mt-48">
              <h2 className="mx-auto max-w-[880px] text-center font-serif text-[42px] font-medium leading-tight text-[#073846] md:text-[54px]">
                {tour.title}-Day-by-Day Itinerary:
              </h2>
              <p className="mt-10 text-center text-[20px] text-[#1887a1]">
                Click each day to view detailed activities ↓
              </p>
              <div className="mt-8 space-y-5">
                {pdfDetail.days.map((day, index) => (
                  <details key={`${day.title}-${index}`} className="group border-l-[4px] border-[#35a895] bg-white shadow-[0_4px_18px_rgba(0,0,0,0.035)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
                      <div className="flex items-center gap-5">
                        {isTransferDay(day.title) && (
                          <span className="text-[#073846]">
                            {day.title.toLowerCase().includes('train') ? <TrainFront size={28} /> : <Plane size={28} />}
                          </span>
                        )}
                        <h3 className="text-[22px] font-medium leading-tight text-[#073846]">{day.title}</h3>
                      </div>
                      <ChevronDown className="shrink-0 text-[#073846] transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="px-6 pb-6 text-[16px] leading-8 text-[#5f686d]">{day.text}</p>
                  </details>
                ))}
              </div>
            </section>

            <section id="included" className="mt-28 scroll-mt-48">
              <h2 className="font-serif text-[42px] font-medium text-[#111] md:text-[52px]">
                Tour Price Inclusions &amp; Exclusions
              </h2>
              <h3 className="mt-12 text-[32px] font-medium text-[#073846]">Included</h3>
              <div className="mt-8 divide-y divide-[#e5e5e5]">
                {includedItems.map(({ label }) => (
                  <details key={label} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-6">
                      <span className="flex items-center gap-7 text-[20px] font-bold text-[#002A3A]">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#65baa9] bg-[#e9f8f2] text-[#2a9f8b]">
                          <Check size={16} />
                        </span>
                        {label}
                      </span>
                      <ChevronDown className="transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-6 pl-16 text-[15px] leading-7 text-[#647078]">
                      Arranged according to the confirmed itinerary, travel dates, and selected service level.
                    </p>
                  </details>
                ))}
              </div>

              <h3 className="mt-16 text-[32px] font-medium text-[#073846]">Not Included</h3>
              <div className="mt-8 divide-y divide-[#e5e5e5]">
                {notIncludedItems.map((label) => (
                  <details key={label} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-6">
                      <span className="flex items-center gap-7 text-[20px] font-bold text-[#002A3A]">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ff7b7b] bg-[#fff0f0] text-[#ff5252]">
                          <CircleX size={16} />
                        </span>
                        {label}
                      </span>
                      <ChevronDown className="transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-6 pl-16 text-[15px] leading-7 text-[#647078]">
                      Can be discussed separately if you want help arranging it.
                    </p>
                  </details>
                ))}
              </div>
            </section>

            <section id="faq" className="mt-28 scroll-mt-48">
              <h2 className="mx-auto max-w-[900px] text-center font-serif text-[42px] font-medium leading-tight text-[#111] md:text-[52px]">
                {tour.title} FAQs
              </h2>
              <div className="mt-12 divide-y divide-[#e5e5e5]">
                {routeGenericFaqs.map((item) => (
                  <details key={item.question} className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6">
                      <h3 className="text-[18px] font-medium leading-7 text-[#111]">{item.question}</h3>
                      <ChevronDown className="shrink-0 text-[#073846] transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-6 text-[16px] leading-8 text-[#5f686d]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          </main>

          <aside id="price" className="scroll-mt-48 lg:sticky lg:top-48 lg:self-start">
            <div className="rounded-[10px] border border-[#c9d8e8] bg-[#eaf4ff] p-8 text-center">
              <p className="font-serif text-[36px] text-[#073846]">Private quote</p>
              <button
                type="button"
                onClick={() => setGroupModalOpen(true)}
                className="mt-7 inline-flex min-h-[56px] w-full items-center justify-center rounded-[8px] bg-[#ef4f43] px-5 text-[20px] font-semibold text-white"
              >
                Group tour inquiry
              </button>
              <button
                type="button"
                onClick={() => setPrivateModalOpen(true)}
                className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center rounded-[8px] bg-[#00394a] px-5 text-[20px] font-semibold text-white"
              >
                Get a Private Quote
              </button>
              <div className="mt-8 space-y-5 text-left text-[16px] leading-7 text-[#6b7378]">
                <p className="flex gap-4">
                  <Users className="mt-1 shrink-0" size={24} />
                  Group tour departures are offered on selected dates.
                </p>
                <p className="flex gap-4">
                  <CalendarDays className="mt-1 shrink-0" size={22} />
                  Private travel offers more flexibility in dates, pace, and group size.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-[10px] border border-[#d9d9d9] bg-white p-8">
              <h3 className="text-center text-[26px] font-medium text-[#111]">Still Planning Your Trip?</h3>
              <Link
                to={`/custom-trip?tour=${encodeURIComponent(tour.title)}`}
                className="mt-8 flex gap-5 text-[#168dad]"
              >
                <HelpCircle size={34} className="shrink-0" />
                <span>
                  <strong className="block text-[22px]">Customize This Itinerary</strong>
                  <span className="mt-2 block text-[16px] leading-7 text-[#6b7378]">
                    Use this itinerary as a starting point. We can refine it around your dates,
                    interests, and pace.
                  </span>
                </span>
              </Link>
              <Link to="/custom-trip" className="mt-8 flex gap-5 text-[#168dad]">
                <MessageCircle size={34} className="shrink-0" />
                <span>
                  <strong className="block text-[22px]">Ask a Local Travel Expert</strong>
                  <span className="mt-2 block text-[16px] leading-7 text-[#6b7378]">
                    Get practical advice on timing, hotels, routing, and what suits your trip best.
                  </span>
                </span>
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <GroupTourInquiryModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
        tour={{ slug: tour.slug, title: tour.title, duration: tour.duration }}
      />
      <PrivateQuoteModal
        open={privateModalOpen}
        onOpenChange={setPrivateModalOpen}
        tour={{ slug: tour.slug, title: tour.title, duration: tour.duration }}
      />
    </div>
  );
}

function buildStructuredDetail(
  tour: NonNullable<ReturnType<typeof getRouteTourBySlug>>,
  structured: NonNullable<NonNullable<ReturnType<typeof getRouteTourBySlug>>['structuredItinerary']>,
): RoutePdfDetail {
  return {
    source: 'Structured itinerary',
    tourCode: tour.slug.toUpperCase(),
    experience: structured.experience,
    moments: structured.moments,
    days: structured.days,
    included: structured.includedSupport,
    notes: [],
  };
}

function buildFallbackDetail(tour: NonNullable<ReturnType<typeof getRouteTourBySlug>>): RoutePdfDetail {
  return {
    source: 'Route library entry',
    tourCode: `ST-${String(tour.id).padStart(3, '0')}`,
    experience: [tour.desc],
    moments: tour.highlights.slice(0, 3),
    days: tour.itinerarySummary.map((item, index) => ({
      title: `Day ${index + 1}`,
      text: item,
    })),
    included: tour.includedSupport,
    notes: ['Final details are confirmed after your dates and travel style are shared.'],
  };
}

function buildGallery(tour: NonNullable<ReturnType<typeof getRouteTourBySlug>>) {
  const destinationImages = tour.destinationSlugs
    .map((slug) => getDestinationBySlug(slug)?.image)
    .filter(Boolean) as string[];
  return Array.from(new Set([tour.image, ...destinationImages, ...fallbackGallery])).slice(0, 5);
}

function buildHighlights(pdfDetail: RoutePdfDetail, title: string) {
  const base = [...pdfDetail.moments, ...pdfDetail.experience].filter(Boolean);
  const polished = base.map((item) => {
    if (item.length < 120) return item;
    return `${item.slice(0, 118).trim()}...`;
  });
  return [
    ...polished,
    `${title} can be arranged as a private journey with local guide support and clear daily pacing.`,
  ].slice(0, 5);
}

function isTransferDay(title: string) {
  const normalized = title.toLowerCase();
  return (
    normalized.includes('arrival') ||
    normalized.includes('departure') ||
    normalized.includes('train') ||
    normalized.includes('flight')
  );
}

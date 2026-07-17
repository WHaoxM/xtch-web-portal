import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Star, Users } from 'lucide-react';
import ChinaTripsMobile from '@/components/ChinaTripsMobile';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { getRouteTourHref, routeTours } from '@/lib/contentStore';

const categories = ['All Tours', 'Classic', 'City Break', 'Culture', 'Nature', 'Regional', 'Silk Road'];
// Card rating is a decorative trust badge, not a stored per-route field in
// Phase 1's approved routes schema (see docs/adr/0003), so it is fixed here.
const FEATURED_RATING_DISPLAY = 4.9;
const tours = routeTours;

export default function ChinaTours() {
  const [activeCategory, setActiveCategory] = useState('All Tours');
  useScrollAnimation('.tour-anim');

  const moreTours = tours.filter((tour) => !tour.featured);
  const filteredTours =
    activeCategory === 'All Tours'
      ? moreTours
      : moreTours.filter((tour) => tour.category === activeCategory);

  return (
    <div>
      <ChinaTripsMobile />

      <div className="hidden lg:block">
        <section className="relative flex min-h-[55vh] items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(/images/hero-forbidden.jpg)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-[#002A3A]/52 to-black/78" />
          <div className="hero-copy-shadow relative z-10 px-6 pt-24 text-center text-white">
            <h1 className="mb-4 font-serif text-4xl leading-[1.1] md:text-5xl lg:text-[64px]">
              Real China Routes
            </h1>
            <p className="mx-auto max-w-3xl text-[15px] leading-relaxed text-white">
              Browse selected routes from the actual tour files, including Beijing, Shanghai,
              Sichuan, Chongqing, Yunnan, Guangxi, northwest China, Xinjiang, and Xi&apos;an.
            </p>
          </div>
        </section>

        <section className="section-padding bg-white py-14">
          <div className="content-max-width">
            <div className="tour-anim animate-fade-up mb-8">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-[#379C8A]">
                Selected Real Tour Products
              </p>
              <h2 className="font-serif text-2xl text-[#002A3A] md:text-3xl">
                Featured routes from your tour library
              </h2>
              <p className="mt-2 text-[14px] text-[#5D5D5D]">
                Each route can be quoted as a private itinerary or arranged for a suitable small
                group plan.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {tours
                .filter((tour) => tour.featured)
                .map((tour, index) => (
                  <Link
                    key={tour.slug}
                    to={getRouteTourHref(tour)}
                    className="tour-anim group animate-fade-up overflow-hidden rounded-xl border border-[#D6D6D6] bg-white shadow-md transition-shadow duration-500 hover:shadow-lg"
                    style={{ transitionDelay: `${index * 0.1}s` }}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={tour.image}
                        alt={tour.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-sm bg-[#379C8A] px-2 py-1 text-[11px] font-medium text-white">
                        <Star size={10} fill="white" /> {FEATURED_RATING_DISPLAY}
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="mb-2 font-sans text-[15px] font-semibold leading-snug text-[#002A3A]">
                        {tour.title}
                      </h3>
                      <div className="mb-3 flex items-center gap-3 text-[12px] text-[#88929C]">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {tour.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {tour.groupSize}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-[#379C8A]">{tour.price}</span>
                        <span className="text-[13px] font-semibold text-[#002A3A]">View Details</span>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </section>

        <section className="section-padding bg-[#F6FAFE] py-14 md:py-16">
          <div className="content-max-width">
            <h2 className="mb-6 font-serif text-2xl text-[#002A3A] md:text-3xl">
              More Listed Routes
            </h2>

            <div className="mb-8 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-5 py-2 text-[13px] font-medium transition-all duration-300 ${
                    activeCategory === category
                      ? 'bg-[#002A3A] text-white'
                      : 'bg-white text-[#5D5D5D] hover:bg-white/70'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredTours.map((tour, index) => (
                <div
                  key={tour.slug}
                  className="tour-anim animate-fade-up overflow-hidden rounded-xl border border-[#D6D6D6] bg-white shadow-sm transition-shadow duration-300 hover:shadow-md"
                  style={{ transitionDelay: `${(index % 3) * 0.08}s` }}
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={tour.image}
                      alt={tour.title}
                      className="h-full w-full object-cover transition-transform duration-700"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="mb-2 line-clamp-2 font-sans text-[15px] font-semibold leading-snug text-[#002A3A]">
                      {tour.title}
                    </h3>
                    <p className="mb-3 line-clamp-2 text-[13px] leading-6 text-[#5D5D5D]">
                      {tour.desc}
                    </p>
                    <div className="mb-3 flex items-center gap-2 text-[12px] text-[#88929C]">
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {tour.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11} /> {tour.groupSize}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#D6D6D6] pt-3">
                      <span className="text-[13px] font-semibold text-[#379C8A]">{tour.price}</span>
                      <Link
                        to={getRouteTourHref(tour)}
                        className="text-[13px] font-semibold text-[#002A3A]"
                      >
                        View Detail
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredTours.length === 0 && (
              <div className="rounded-[10px] border border-[#D6D6D6] bg-white p-8 text-center text-[15px] leading-8 text-[#5D5D5D]">
                Featured routes for this category are shown above. Choose another category to browse
                additional route cards.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

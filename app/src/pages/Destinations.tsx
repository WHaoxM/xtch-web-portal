import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { destinationMeta, getToursByDestination } from '@/lib/contentStore';

export default function Destinations() {
  useScrollAnimation('.dest-anim');

  return (
    <div className="bg-white">
      <section className="relative flex min-h-[62vh] items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/hero-greatwall.jpg)' }}
        />
        <div className="absolute inset-0 bg-[#002A3A]/68" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/24 via-transparent to-black/52" />
        <div className="hero-copy-shadow relative z-10 px-6 pt-24 text-center text-white">
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6FD1D7]">
            Real destination pages
          </p>
          <h1 className="mx-auto mb-5 max-w-4xl font-serif text-4xl leading-[1.05] md:text-5xl lg:text-[58px]">
            China Destinations With Real Routes
          </h1>
          <p className="mx-auto max-w-3xl text-[15px] leading-7 text-white">
            Every destination below links to its own page and shows only route products from the
            current Syncing Travel route library.
          </p>
        </div>
      </section>

      <section className="section-padding bg-white py-16 md:py-20">
        <div className="content-max-width max-w-3xl text-center">
          <h2 className="dest-anim animate-fade-up font-sans text-[22px] font-light uppercase tracking-[0.08em] text-[#002A3A] md:text-[28px]">
            Current Route Coverage
          </h2>
          <p
            className="dest-anim animate-fade-up mt-5 text-[15px] leading-8 text-[#5D5D5D]"
            style={{ transitionDelay: '0.08s' }}
          >
            Current route coverage includes {destinationMeta.map((destination) => destination.name).join(', ')}. If a destination is not
            listed here, it is not being presented as a public route category yet.
          </p>
        </div>
      </section>

      <section className="section-padding bg-[#002A3A] py-16 md:py-20">
        <div className="content-max-width">
          <div className="grid grid-cols-1 gap-x-7 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            {destinationMeta.map((destination, index) => {
              const tours = getToursByDestination(destination.slug);
              return (
                <Link
                  key={destination.slug}
                  to={`/destinations/${destination.slug}`}
                  className="dest-anim animate-fade-up group relative overflow-hidden rounded-[10px] shadow-[0_0_17px_rgba(0,42,58,0.26)]"
                  style={{ transitionDelay: `${(index % 3) * 0.08}s` }}
                >
                  <div className="absolute inset-0">
                    <img
                      src={destination.image}
                      alt={destination.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      loading={index < 3 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/22 to-transparent" />
                  <div className="relative flex min-h-[500px] flex-col justify-end px-8 pb-8 pt-20">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6FD1D7]">
                      {tours.length} route{tours.length === 1 ? '' : 's'}
                    </p>
                    <h3 className="font-serif text-[34px] leading-none text-white md:text-[38px]">
                      {destination.name}
                    </h3>
                    <p className="mt-4 max-w-[34ch] text-[13px] leading-7 text-white/80">
                      {destination.description}
                    </p>
                    <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/65 px-5 py-2.5 text-[12px] font-medium tracking-[0.04em] text-white transition-colors duration-300 group-hover:bg-white group-hover:text-[#0f1820]">
                      View {destination.name} routes
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

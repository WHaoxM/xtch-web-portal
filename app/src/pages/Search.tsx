import { type FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search as SearchIcon, SlidersHorizontal } from 'lucide-react';
import { buildSearchIndex, searchSite, type SearchResultType } from '@/lib/searchIndex';

const filters: Array<'All' | SearchResultType> = ['All', 'Destination', 'Tour', 'Guide', 'Service', 'Company'];

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>('All');

  const indexSize = useMemo(() => buildSearchIndex().length, []);

  const results = useMemo(() => {
    const found = searchSite(initialQuery);
    return activeFilter === 'All' ? found : found.filter((item) => item.type === activeFilter);
  }, [activeFilter, initialQuery]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  };

  const isAssetLink = (href: string) => href.startsWith('/assets/') || href.endsWith('.pdf');
  const resultClassName =
    'group overflow-hidden rounded-[10px] border border-[#D6D6D6] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_46px_rgba(0,42,58,0.12)]';

  return (
    <div className="bg-white">
      <section className="section-padding relative min-h-[50vh] overflow-hidden bg-[#002A3A]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/images/ref-banner-misty-river.jpg)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/86 via-[#002A3A]/76 to-[#002A3A]/34" />
        <div className="content-max-width relative flex min-h-[50vh] items-center pt-28">
          <div className="max-w-4xl py-12 text-white">
            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#6FD1D7]">
              Site Search
            </p>
            <h1 className="font-serif text-[40px] leading-[1.12] text-white md:text-[58px]">
              Search China tours, destinations, and travel guidance
            </h1>
            <p className="mt-5 max-w-2xl text-[16px] leading-8 text-white/78">
              Find private China routes, destination ideas, planning services, and practical travel
              topics from the Syncing Travel route library.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding bg-[#F6FAFE] py-10">
        <div className="content-max-width">
          <form
            onSubmit={handleSubmit}
            role="search"
            className="grid grid-cols-1 gap-3 rounded-[10px] border border-[#D6D6D6] bg-white p-3 shadow-[0_18px_50px_rgba(0,42,58,0.08)] md:grid-cols-[1fr_auto]"
          >
            <label className="sr-only" htmlFor="search-page-input">
              Search Syncing Travel
            </label>
            <div className="flex min-h-[52px] items-center gap-3 rounded-[8px] bg-[#F9F9FB] px-4">
              <SearchIcon size={18} className="shrink-0 text-[#379C8A]" />
              <input
                id="search-page-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try Beijing, Silk Road, visa, Jiuzhaigou, custom trip..."
                className="min-w-0 flex-1 bg-transparent text-[15px] text-[#002A3A] outline-none placeholder:text-[#88929C]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[8px] bg-[#002A3A] px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[#093C5D]"
            >
              Search
              <ArrowRight size={17} />
            </button>
          </form>
        </div>
      </section>

      <section className="section-padding bg-white py-12 md:py-16">
        <div className="content-max-width grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[10px] border border-[#D6D6D6] bg-[#F9F9FB] p-4">
              <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#002A3A]">
                <SlidersHorizontal size={15} />
                Filter
              </div>
              <div className="flex flex-wrap gap-2 lg:flex-col">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-[8px] px-4 py-2.5 text-left text-[14px] font-semibold transition-colors ${
                      activeFilter === filter
                        ? 'bg-[#002A3A] text-white'
                        : 'bg-white text-[#5D5D5D] hover:bg-[#F6FAFE] hover:text-[#002A3A]'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div>
            <div className="mb-6">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#379C8A]">
                {results.length} result{results.length === 1 ? '' : 's'}
              </p>
              <h2 className="mt-2 font-serif text-[30px] leading-tight text-[#002A3A] md:text-[40px]">
                {initialQuery ? `Results for "${initialQuery}"` : 'Browse the search index'}
              </h2>
              {!initialQuery && (
                <p className="mt-3 max-w-2xl text-[15px] leading-8 text-[#5D5D5D]">
                  The search index includes {indexSize} destinations, routes, services,
                  guide topics, and company pages.
                </p>
              )}
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {results.map((item) => {
                  const body = (
                    <>
                      {item.image && (
                        <div className="aspect-[16/9] overflow-hidden bg-[#D6D6D6]">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="p-5">
                        <span className="rounded-full bg-[#F0FAF7] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1D6F62]">
                          {item.type}
                        </span>
                        <h3 className="mt-4 font-sans text-[18px] font-semibold leading-snug text-[#002A3A]">
                          {item.title}
                        </h3>
                        <p className="mt-3 line-clamp-3 text-[14px] leading-7 text-[#5D5D5D]">
                          {item.description}
                        </p>
                        <span className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-[#002A3A]">
                          {isAssetLink(item.href) ? 'Open PDF' : 'Open result'}
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </>
                  );

                  return isAssetLink(item.href) ? (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={resultClassName}
                    >
                      {body}
                    </a>
                  ) : (
                    <Link key={item.id} to={item.href} className={resultClassName}>
                      {body}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[10px] border border-[#D6D6D6] bg-[#F9F9FB] p-8 text-center">
                <h3 className="font-serif text-[28px] text-[#002A3A]">No matching results</h3>
                <p className="mx-auto mt-3 max-w-xl text-[15px] leading-8 text-[#5D5D5D]">
                  Try a broader word such as China tour, Beijing, Yunnan, Silk Road, visa, or
                  custom trip.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

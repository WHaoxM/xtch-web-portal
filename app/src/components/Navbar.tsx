import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, MapPin, Menu, Search, Sparkles, X } from 'lucide-react';
import { searchSite, type SearchResult } from '@/lib/searchIndex';
import { brand } from '@/lib/siteData';
import { destinationMeta } from '@/lib/contentStore';

const desktopNavLinks = [
  { path: '/', label: 'Home' },
  { path: '/featured-services', label: 'Featured Services' },
  { path: '/about', label: 'About' },
];

const mobileNavLinks = [
  { path: '/', label: 'Home' },
  { path: '/china-trips', label: 'China Trips' },
  { path: '/featured-services', label: 'Featured Services' },
  { path: '/about', label: 'About' },
  { path: '/custom-trip', label: 'Contact Us' },
];

const featuredDestinationNames = ['Beijing', 'Shanghai', "Xi'an", 'Chengdu', 'Zhangjiajie', 'Guilin'];

export default function Navbar() {
  const featuredDestinations = useMemo(
    () =>
      featuredDestinationNames.map((name) => {
        const match = destinationMeta.find((destination) => destination.name === name);
        return {
          name,
          href: match ? `/destinations/${match.slug}` : '/china-trips',
        };
      }),
    [],
  );
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastScroll, setLastScroll] = useState(0);
  const [chinaTripsOpen, setChinaTripsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const searchResults = useMemo(() => searchSite(searchQuery, searchQuery.trim() ? 8 : 6), [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 60);
      if (y > lastScroll && y > 300) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      setLastScroll(y);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScroll]);

  useEffect(() => {
    const closeMenus = window.setTimeout(() => {
      setMobileOpen(false);
      setChinaTripsOpen(false);
      setSearchOpen(false);
    }, 0);

    return () => window.clearTimeout(closeMenus);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileOpen(false);
        setChinaTripsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!chinaTripsOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-china-trips-menu]')) {
        setChinaTripsOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    return () => document.removeEventListener('pointerdown', closeOnPointerDown);
  }, [chinaTripsOpen]);

  const openSearch = () => {
    setSearchOpen(true);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && searchResults[0]) {
      event.preventDefault();
      const query = searchQuery.trim();
      if (query) {
        navigate(`/search?q=${encodeURIComponent(query)}`);
      } else if (isAssetHref(searchResults[0].href)) {
        window.open(searchResults[0].href, '_blank', 'noopener,noreferrer');
      } else {
        navigate(searchResults[0].href);
      }
      setSearchOpen(false);
    }

    if (event.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
    setSearchOpen(false);
  };

  const goToSearchPage = () => {
    const query = searchQuery.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
    setSearchOpen(false);
  };

  const resultDetail = (item: SearchResult) =>
    item.keywords.slice(0, 2).join(' / ') || item.description;

  const isAssetHref = (href: string) => href.startsWith('/assets/') || href.endsWith('.pdf');

  const linkHref = (href: string) => (isAssetHref(href) ? href : `#${href}`);

  const renderSearchPanel = (inputId: string, className: string) => (
    <form
      role="search"
      onSubmit={handleSearchSubmit}
      className={`rounded-[10px] border border-[#D6D6D6] bg-white p-3 shadow-[0_18px_50px_rgba(0,0,0,0.16)] ${className}`}
    >
      <label className="sr-only" htmlFor={inputId}>
        Search destinations and routes
      </label>
      <div className="flex items-center gap-2 rounded-[10px] border border-[#D6D6D6] px-3 py-2 focus-within:border-[#002A3A]">
        <Search size={16} className="text-[#88929C]" />
        <input
          id={inputId}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          autoFocus
          placeholder="Search destinations or routes"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[#002A3A] outline-none placeholder:text-[#88929C]"
        />
      </div>
      <div className="mt-3 max-h-[330px] overflow-y-auto">
        {searchResults.length > 0 ? (
          searchResults.map((item) => (
            <a
              key={item.id}
              href={linkHref(item.href)}
              target={isAssetHref(item.href) ? '_blank' : undefined}
              rel={isAssetHref(item.href) ? 'noopener noreferrer' : undefined}
              className="block rounded-lg px-3 py-3 transition-colors hover:bg-[#F6FAFE]"
              onClick={() => setSearchOpen(false)}
            >
              <span className="block text-[13px] font-semibold text-[#002A3A]">{item.title}</span>
              <span className="mt-1 block text-[12px] text-[#88929C]">
                {item.type} / {resultDetail(item)}
              </span>
            </a>
          ))
        ) : (
          <p className="px-3 py-5 text-[13px] leading-6 text-[#5D5D5D]">
            No matching destinations or routes. Try Beijing, Chengdu, Silk Road, or Jiuzhaigou.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={goToSearchPage}
        className="mt-2 flex w-full items-center justify-center rounded-lg bg-[#F6FAFE] px-4 py-2.5 text-[13px] font-semibold text-[#002A3A] transition-colors hover:bg-[#EAF4FB]"
      >
        View all search results
      </button>
    </form>
  );

  const usesTransparentHero =
    location.pathname === '/' ||
    location.pathname.startsWith('/tours/') ||
    location.pathname === '/custom-trip';
  const isTransparent = usesTransparentHero && !scrolled;
  const isActivePath = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isChinaTripsActive =
    isActivePath('/china-trips') ||
    isActivePath('/china-tours') ||
    isActivePath('/destinations') ||
    isActivePath('/tours') ||
    isActivePath('/custom-trip');
  const navTextClass = isTransparent
    ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] hover:text-white'
    : 'text-[#334850] hover:text-[#002A3A]';
  const activeTextClass = isTransparent ? 'text-white' : 'text-[#002A3A]';
  const underlineClass = isTransparent ? 'bg-white' : 'bg-[#002A3A]';

  return (
    <>
      {searchOpen && (
        <button
          type="button"
          aria-label="Close search"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          onClick={() => setSearchOpen(false)}
        />
      )}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          location.pathname === '/china-trips' || location.pathname === '/china-tours'
            ? 'china-trips-miniapp-nav'
            : ''
        } ${
          hidden && !mobileOpen ? '-translate-y-full' : 'translate-y-0'
        } ${
          isTransparent
            ? 'bg-transparent'
            : 'bg-white/92 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-xl'
        }`}
      >
        <div className="mx-auto max-w-[1760px] px-6 md:px-10 xl:px-12">
          <div className="flex items-start justify-between py-4 xl:pt-6 xl:pb-4">
            <Link to="/" className="shrink-0 pt-0.5">
              <img
                src={brand.logoSrc}
                alt={brand.fullName}
                className={`h-auto rounded-full transition-all duration-300 ${
                  isTransparent ? 'w-[88px] opacity-100 xl:w-[128px]' : 'w-[82px] opacity-95 xl:w-[104px]'
                }`}
              />
            </Link>

            <div className="hidden items-center gap-8 pt-4 xl:flex">
              <Link
                to="/"
                className={`relative whitespace-nowrap text-[16px] font-bold transition-colors duration-300 ${
                  isActivePath('/') ? activeTextClass : navTextClass
                }`}
              >
                Home
                <span
                  className={`absolute -bottom-2 left-0 h-[1.5px] transition-all duration-300 ${
                    isActivePath('/') ? 'w-full' : 'w-0'
                  } ${underlineClass}`}
                />
              </Link>

              <div
                data-china-trips-menu
                className="relative"
                onMouseEnter={() => setChinaTripsOpen(true)}
                onMouseLeave={() => setChinaTripsOpen(false)}
              >
                <Link
                  to="/china-trips"
                  className={`relative inline-flex items-center gap-1.5 whitespace-nowrap text-[16px] font-bold transition-colors duration-300 ${
                    isChinaTripsActive ? activeTextClass : navTextClass
                  }`}
                >
                  China Trips
                  <ChevronDown size={15} className="mt-px" />
                  <span
                    className={`absolute -bottom-2 left-0 h-[1.5px] transition-all duration-300 ${
                      isChinaTripsActive ? 'w-full' : 'w-0'
                    } ${underlineClass}`}
                  />
                </Link>
                <div
                  className={`absolute left-1/2 top-full w-[720px] -translate-x-1/2 pt-5 transition-all duration-200 ${
                    chinaTripsOpen
                      ? 'pointer-events-auto translate-y-0 opacity-100'
                      : 'pointer-events-none -translate-y-2 opacity-0'
                  }`}
                >
                  <div className="grid grid-cols-[1.1fr_0.9fr] gap-6 rounded-[10px] border border-black/5 bg-white p-6 text-[#002A3A] shadow-[0_22px_58px_rgba(0,0,0,0.18)]">
                    <div>
                      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#b28b55]">
                        Popular Destinations
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {featuredDestinations.map((item) => (
                          <Link
                            key={item.name}
                            to={item.href}
                            className="group flex items-center gap-2 rounded-[8px] px-3 py-3 text-[14px] font-semibold text-[#365159] transition-colors hover:bg-[#F6FAFE] hover:text-[#002A3A]"
                          >
                            <MapPin size={15} className="text-[#b28b55] transition-colors group-hover:text-[#002A3A]" />
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[8px] bg-[#F7F3EA] p-4">
                      <Link
                        to="/china-trips"
                        className="group block rounded-[8px] bg-white p-4 shadow-[0_8px_24px_rgba(54,38,18,0.06)] transition-transform hover:-translate-y-0.5"
                      >
                        <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b28b55]">
                          <Sparkles size={14} />
                          Curated Routes
                        </span>
                        <strong className="mt-3 block font-serif text-[22px] font-medium text-[#002A3A]">
                          All China Trips
                        </strong>
                        <span className="mt-2 block text-[13px] leading-6 text-[#5D5D5D]">
                          Browse ready-made private routes across China.
                        </span>
                      </Link>
                      <Link
                        to="/custom-trip"
                        className="mt-3 flex min-h-[48px] items-center justify-between rounded-[8px] bg-[#002A3A] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#063b4f]"
                      >
                        Plan a Custom Trip
                        <ArrowRight size={17} />
                      </Link>
                      <p className="mt-4 text-[12px] leading-5 text-[#6f6a5c]">
                        Private routes, local planning, and on-trip support.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {desktopNavLinks.slice(1).map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative whitespace-nowrap text-[16px] font-bold transition-colors duration-300 ${
                    isActivePath(link.path) ? activeTextClass : navTextClass
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-2 left-0 h-[1.5px] transition-all duration-300 ${
                      isActivePath(link.path) ? 'w-full' : 'w-0'
                    } ${underlineClass}`}
                  />
                </Link>
              ))}
            </div>

            <div className="hidden items-center gap-5 pt-3 xl:flex">
              <Link
                to="/custom-trip"
                className={`text-[16px] font-bold transition-colors ${
                  isTransparent
                    ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] hover:text-white'
                    : 'text-[#334850] hover:text-[#002A3A]'
                }`}
              >
                Contact Us
              </Link>
              <div data-site-search className="relative">
                <button
                  type="button"
                  aria-label="Search destinations and routes"
                  onClick={openSearch}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                    isTransparent
                      ? 'border-white/42 bg-white/18 text-white shadow-[0_2px_12px_rgba(0,0,0,0.25)] hover:bg-white/26'
                      : 'border-[#ece8e0] bg-white text-[#002A3A] shadow-[0_10px_24px_rgba(0,0,0,0.05)] hover:border-[#D6D6D6]'
                  }`}
                >
                  <Search size={18} />
                </button>
                {searchOpen && renderSearchPanel('site-search-desktop', 'absolute right-0 top-full mt-3 w-[360px]')}
              </div>
            </div>

            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className={`mt-1 rounded-md p-2 transition-colors xl:hidden ${
                isTransparent
                  ? 'text-white hover:bg-white/10'
                  : 'text-[#002A3A] hover:bg-[#F6FAFE]'
              }`}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        aria-hidden={!mobileOpen}
        className={`fixed top-0 right-0 bottom-0 z-[70] w-[320px] transform bg-white transition-transform duration-500 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        <div className="flex h-full flex-col p-6">
          <div className="mb-10 flex items-center justify-between">
            <img
              src={brand.logoSrc}
              alt={brand.fullName}
              className="h-auto w-[86px] rounded-full"
            />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-2 transition-colors hover:bg-[#f2f2f2]"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {mobileNavLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`block rounded-lg px-4 py-3 text-[15px] transition-colors ${
                  isActivePath(link.path)
                    ? 'bg-[#F6FAFE] font-medium text-[#002A3A]'
                    : 'text-[#444] hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-auto border-t border-[#D6D6D6] pt-6">
            <button
              type="button"
              aria-label="Search destinations and routes"
              onClick={openSearch}
              className="flex h-[46px] w-full items-center gap-3 rounded-[12px] bg-[#F6FAFE] px-4 text-left text-[#88929C]"
            >
              <Search size={16} />
              <span className="text-[13px]">Search</span>
            </button>
            {mobileOpen && searchOpen && (
              <div data-site-search className="relative mt-3">
                {renderSearchPanel('site-search-mobile', 'w-full')}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { getRouteTourBySlug } from '@/lib/contentStore';
import {
  departureAvailability,
  fetchPublicDepartures,
  formatDeparturePrice,
  groupDeparturesByRoute,
  type PublicDeparture,
} from '@/lib/departuresClient';
import { formatOrderDateRange } from '@/lib/orderClient';

type LoadState = 'loading' | 'ready' | 'error';

export default function GroupTours() {
  const [departures, setDepartures] = useState<PublicDeparture[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicDepartures(controller.signal)
      .then((records) => {
        setDepartures(records);
        setLoadState('ready');
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'We could not load departures.');
        setLoadState('error');
      });

    return () => controller.abort();
  }, [reloadKey]);

  const routeGroups = useMemo(() => groupDeparturesByRoute(departures), [departures]);
  const availableDepartureCount = departures.filter(
    (departure) => departureAvailability(departure).bookable,
  ).length;

  return (
    <div className="bg-[#F4F8F7] text-[#002A3A]">
      <section className="relative isolate min-h-[520px] overflow-hidden bg-[#07191C]">
        <img
          src="/images/syncing-real-place-jiuzhaigou-lake.jpg"
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,25,35,0.88),rgba(0,25,35,0.54)_58%,rgba(0,25,35,0.24)),linear-gradient(180deg,rgba(0,0,0,0.38),transparent_45%,rgba(0,0,0,0.45))]" />
        <div className="mx-auto flex min-h-[520px] max-w-[1180px] items-end px-6 pb-16 pt-32 md:px-10 md:pb-20">
          <div className="max-w-[760px] text-white">
            <p className="mb-5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.22em] text-white/80">
              <UsersRound size={17} aria-hidden="true" />
              Fixed departures
            </p>
            <h1 className="font-serif text-[44px] font-medium leading-[1.08] text-white md:text-[68px]">
              Social Tours
              <br />
              Ready to Join
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-8 text-white/88 md:text-[18px]">
              Browse published routes with real departure dates, live seat availability, and fixed
              adult prices.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-14 md:px-10 md:py-20" aria-labelledby="group-tour-list-heading">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 flex flex-col justify-between gap-5 border-b border-[#C8D8D5] pb-8 md:flex-row md:items-end">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#287F73]">
                Published schedule
              </p>
              <h2
                id="group-tour-list-heading"
                className="mt-3 font-serif text-[34px] leading-tight md:text-[46px]"
              >
                Routes and departure dates
              </h2>
            </div>
            {loadState === 'ready' && departures.length > 0 ? (
              <p className="text-[14px] text-[#52666C]" aria-live="polite">
                {availableDepartureCount} bookable departure
                {availableDepartureCount === 1 ? '' : 's'} across {routeGroups.length} route
                {routeGroups.length === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>

          {loadState === 'loading' ? (
            <div
              className="rounded-2xl border border-[#D5E1DF] bg-white px-6 py-16 text-center text-[#52666C]"
              role="status"
            >
              Loading current departures…
            </div>
          ) : null}

          {loadState === 'error' ? (
            <div
              className="rounded-2xl border border-[#D5E1DF] bg-white px-6 py-14 text-center"
              role="alert"
            >
              <h3 className="font-serif text-[28px]">Departure dates are temporarily unavailable</h3>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-[#5D6B70]">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadState('loading');
                  setError('');
                  setReloadKey((value) => value + 1);
                }}
                className="mt-7 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#002A3A] px-6 text-[14px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002A3A]"
              >
                Try again
              </button>
            </div>
          ) : null}

          {loadState === 'ready' && routeGroups.length === 0 ? <EmptyDepartures /> : null}

          {loadState === 'ready' && routeGroups.length > 0 ? (
            <div className="space-y-8">
              {routeGroups.map((group) => {
                const route = getRouteTourBySlug(group.routeSlug);
                return (
                  <article
                    key={group.routeSlug}
                    className="overflow-hidden rounded-2xl border border-[#D5E1DF] bg-white shadow-[0_18px_50px_rgba(0,42,58,0.07)]"
                  >
                    <div className="grid md:grid-cols-[280px_1fr]">
                      <div className="relative min-h-[230px] overflow-hidden bg-[#DCE8E6]">
                        <img
                          src={route?.image || '/images/syncing-real-place-jiuzhaigou-lake.jpg'}
                          alt={group.routeTitle}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#001D29]/68 via-transparent to-transparent" />
                        {route?.duration ? (
                          <span className="absolute bottom-5 left-5 rounded-full bg-white/92 px-3 py-1.5 text-[12px] font-semibold text-[#002A3A]">
                            {route.duration}
                          </span>
                        ) : null}
                      </div>

                      <div className="p-6 md:p-8">
                        <div className="flex flex-col justify-between gap-5 border-b border-[#E2E9E7] pb-6 sm:flex-row sm:items-start">
                          <div>
                            <h3 className="font-serif text-[28px] leading-tight md:text-[34px]">
                              {group.routeTitle}
                            </h3>
                            {route?.desc ? (
                              <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[#5D6B70]">
                                {route.desc}
                              </p>
                            ) : null}
                          </div>
                          <Link
                            to={`/tours/${group.routeSlug}`}
                            className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg border border-[#B7CBC7] px-4 text-[13px] font-semibold text-[#002A3A] transition-colors hover:bg-[#EFF6F4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287F73]"
                          >
                            View route
                            <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        </div>

                        <div className="divide-y divide-[#E2E9E7]">
                          {group.departures.map((departure) => (
                            <DepartureRow key={departure.publicId} departure={departure} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DepartureRow({ departure }: { departure: PublicDeparture }) {
  const availability = departureAvailability(departure);

  return (
    <div className="grid gap-5 py-6 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_auto] lg:items-center">
      <div className="flex gap-3">
        <CalendarDays className="mt-0.5 shrink-0 text-[#287F73]" size={19} aria-hidden="true" />
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#718087]">
            Travel dates
          </p>
          <p className="mt-1 text-[15px] font-semibold">
            {formatOrderDateRange(departure.startDate, departure.endDate)}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <MapPin className="mt-0.5 shrink-0 text-[#287F73]" size={19} aria-hidden="true" />
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#718087]">
            Departs from
          </p>
          <p className="mt-1 text-[15px] font-semibold">{departure.departureCity}</p>
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#718087]">
          Adult price
        </p>
        <p className="mt-1 text-[18px] font-semibold text-[#002A3A]">
          {formatDeparturePrice(departure)}
          <span className="ml-1 text-[12px] font-normal text-[#718087]">per person</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 lg:max-w-[180px] lg:justify-end">
        {departure.guaranteed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E4F3ED] px-3 py-1.5 text-[12px] font-semibold text-[#176B5C]">
            <ShieldCheck size={14} aria-hidden="true" />
            Guaranteed
          </span>
        ) : null}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            availability.bookable
              ? 'bg-[#EDF6FF] text-[#245D83]'
              : 'bg-[#F1F2F2] text-[#68757A]'
          }`}
        >
          {availability.bookable ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
          {availability.label}
        </span>
      </div>
    </div>
  );
}

function EmptyDepartures() {
  return (
    <div className="rounded-2xl border border-[#D5E1DF] bg-white px-6 py-14 text-center">
      <UsersRound className="mx-auto text-[#287F73]" size={34} aria-hidden="true" />
      <h3 className="mt-5 font-serif text-[30px]">No published departures right now</h3>
      <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-[#5D6B70]">
        We have not published a fixed group-tour date yet. Explore our current routes or tell us
        your dates and we will help shape a custom trip.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/custom-trip"
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#002A3A] px-6 text-[14px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002A3A]"
        >
          Plan a Custom Trip
        </Link>
        <Link
          to="/china-trips"
          className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#B7CBC7] px-6 text-[14px] font-semibold text-[#002A3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287F73]"
        >
          Browse China Routes
        </Link>
      </div>
    </div>
  );
}

import { type ComponentType, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Home,
  LogOut,
  Mail,
  Map,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  Star,
  UsersRound,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import {
  clearStoredAuthSession,
  consumeAuthRedirectSession,
  consumePendingAuthIntent,
  consumePostAuthMeFocus,
  isAuthConfigured,
  markPostAuthMeFocus,
  readStoredAuthSession,
  sendEmailOtp,
  signInWithOAuth,
  subscribeAuthSession,
  verifyEmailOtp,
  type AuthIntent,
  type AuthProvider,
  type AuthUser,
} from '@/lib/authClient';
import { createFixedDepartureCheckoutSession } from '@/lib/checkoutClient';
import { endDateFromDuration, normalizeDateOnly } from '@/lib/dateOnly';
import { LinkOrderToAccount } from '@/components/LinkOrderToAccount';
import {
  fetchMyOrders,
  fetchOrderSummary,
  formatConfirmationEmailNote,
  formatOrderDateRange,
  type SafeOrderSummary,
} from '@/lib/orderClient';
import { CustomTripPreferenceSections } from '@/components/CustomTripPreferenceFields';
import { MobileDestinationCard } from '@/components/mobile/MobileDestinationCard';
import { MobileDestinationListRow } from '@/components/mobile/MobileDestinationListRow';
import { MobileRouteListCard } from '@/components/mobile/MobileRouteListCard';
import {
  getPlaceBestFor,
  getPlacePace,
  getPlacePlanningNote,
  getPlaceSeason,
  getPlaceTiming,
  getPlaceWhy,
} from '@/lib/placeDetailCopy';
import { asStringList, formatCancellationPolicy } from '@/lib/departurePolicy';
import {
  fetchCustomTripFormConfig,
  preferenceFieldsByGroup,
  preferenceFieldsForRoutePrivate,
  validatePreferenceAnswers,
  type CustomPreferences,
  type CustomTripFormField,
} from '@/lib/customTripFormClient';
import {
  fieldErrorId,
  focusFirstFieldError,
  isValidEmail,
  type FieldErrors,
} from '@/lib/formErrors';
import { submitInquiry } from '@/lib/inquiryClient';
import {
  buildInternationalPhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneCountry,
  PHONE_COUNTRIES,
  validateOptionalPhoneInput,
} from '@/lib/phoneCountries';
import { getRoutePdfDetail, type RoutePdfDetail } from '@/lib/routePdfDetails';
import { brand } from '@/lib/siteData';
import { destinationMeta, routeTours } from '@/lib/contentStore';
import { fetchCategories, type Category } from '@/lib/categoriesClient';
import {
  resizeTravelers,
  validateTravelerNames,
  type TravelerNameDraft,
} from '@/lib/travelerNames';
import {
  fadeUpItem,
  listRowVariants,
  pageVariants,
  staggerListVariants,
  tabPanelVariants,
  tapScale,
  tapScaleSoft,
} from '@/components/chinaTripsMobileMotion';
import './chinaTripsMobile.css';

type MobileTab = 'home' | 'destinations' | 'routes' | 'custom' | 'me';
type MobileView =
  | 'tabs'
  | 'searchResults'
  | 'groupRequest'
  | 'signIn'
  | 'reserveReview'
  | 'placeDetail'
  | 'routeDetail'
  | 'routePrivateRequest'
  | 'featuredGroupDetail'
  | 'bookingConfirmed'
  | 'myOrders';
type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type CheckoutStatus = 'idle' | 'loading' | 'error';
type BookingConfirmedStatus = 'loading' | 'ready' | 'error';
type MyOrdersStatus = 'loading' | 'ready' | 'error';
type AuthStatus = 'idle' | 'loading' | 'message' | 'error';
type CustomSubmitStatus = 'idle' | 'loading' | 'success' | 'error';

type GroupRequestDraft = {
  destinationSlug: string;
  routeSlug: string;
  departureId: string;
  dateRange: string;
  adultQuantity: number;
  travelers: TravelerNameDraft[];
  name: string;
  email: string;
  phoneCountry: string;
  phoneNational: string;
  phone: string;
  notes: string;
};

type CustomTripDraft = {
  destinations: string[];
  otherDestination: string;
  travelMonth: string;
  travelers: string;
  tripLength: string;
  interests: string[];
  name: string;
  email: string;
  phoneCountry: string;
  phoneNational: string;
  phone: string;
  contactPreferences: string[];
  message: string;
};

type RoutePrivateDraft = {
  travelMonth: string;
  datesFlexible: boolean;
  travelers: string;
  name: string;
  email: string;
  phoneCountry: string;
  phoneNational: string;
  phone: string;
  message: string;
};

type CustomTextField = Exclude<
  keyof CustomTripDraft,
  'destinations' | 'interests' | 'contactPreferences' | 'phoneCountry' | 'phoneNational' | 'phone'
>;
type CustomChoiceField = 'destinations' | 'interests' | 'contactPreferences';
type PlaceFilterKey = string;
type RouteFilterKey = string;

/** Sentinel for unfiltered Destinations/Routes lists; invalid as categories.key (SLUG_PATTERN). */
const ALL_FILTER_KEY = '__all__';

type GroupTourDeparture = {
  id: string;
  routeSlug: string;
  startDate: string;
  endDate: string;
  departureCity: string;
  spotsLeft: number;
  capacity: number;
  adultPriceCents: number;
  currency: string;
  guaranteed: boolean;
  status: 'Available';
  note: string;
  includedItems: string[];
  excludedItems: string[];
  importantNotes: string[];
  cancellationLines: string[];
};

function mapApiDepartureToUi(apiDeparture: {
  public_id: string;
  route_slug: string;
  start_date: string;
  end_date: string;
  departure_city: string;
  available_seats: number;
  capacity: number;
  adult_unit_price_cents: number;
  currency?: string;
  guaranteed?: boolean;
  confirmation_rule: string;
  included_core_items?: unknown;
  excluded_core_items?: unknown;
  important_notes?: unknown;
  cancellation_policy_snapshot?: unknown;
}): GroupTourDeparture {
  return {
    id: apiDeparture.public_id,
    routeSlug: apiDeparture.route_slug,
    startDate: apiDeparture.start_date,
    endDate: apiDeparture.end_date,
    departureCity: apiDeparture.departure_city,
    spotsLeft: Math.max(0, apiDeparture.available_seats),
    capacity: apiDeparture.capacity,
    adultPriceCents: apiDeparture.adult_unit_price_cents,
    currency: (apiDeparture.currency || 'usd').toUpperCase(),
    guaranteed: Boolean(apiDeparture.guaranteed),
    status: 'Available',
    note: apiDeparture.confirmation_rule,
    includedItems: asStringList(apiDeparture.included_core_items),
    excludedItems: asStringList(apiDeparture.excluded_core_items),
    importantNotes: asStringList(apiDeparture.important_notes),
    cancellationLines: formatCancellationPolicy(apiDeparture.cancellation_policy_snapshot),
  };
}

function normalizeGroupDraft(draft: Partial<GroupRequestDraft> | null | undefined): GroupRequestDraft {
  const adultQuantity = Math.max(1, Number(draft?.adultQuantity) || 1);
  const travelers = resizeTravelers(draft?.travelers, adultQuantity, draft?.name ?? '');
  const phoneCountry = draft?.phoneCountry || DEFAULT_PHONE_COUNTRY_CODE;
  const phoneNational = draft?.phoneNational ?? '';
  const phone =
    draft?.phone ||
    buildInternationalPhone(phoneCountry, phoneNational) ||
    '';

  return {
    destinationSlug: draft?.destinationSlug ?? '',
    routeSlug: draft?.routeSlug ?? '',
    departureId: draft?.departureId ?? '',
    dateRange: draft?.dateRange ?? '',
    adultQuantity,
    travelers,
    name: travelers[0]?.name ?? draft?.name ?? '',
    email: draft?.email ?? '',
    phoneCountry,
    phoneNational,
    phone,
    notes: draft?.notes ?? '',
  };
}

const googleIconSrc = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg';
const appleIconSrc = 'https://cdn.simpleicons.org/apple/000000';
const appleIconLightSrc = 'https://cdn.simpleicons.org/apple/FFFFFF';
const pendingGroupDraftStorageKey = 'syncing_travel_pending_group_request';
const pendingGroupDraftMaxAgeMs = 60 * 60 * 1000;

const initialDraft: GroupRequestDraft = normalizeGroupDraft({
  adultQuantity: 1,
  travelers: [{ name: '' }],
});

const initialCustomDraft: CustomTripDraft = {
  destinations: [],
  otherDestination: '',
  travelMonth: '',
  travelers: '',
  tripLength: '',
  interests: [],
  name: '',
  email: '',
  phoneCountry: DEFAULT_PHONE_COUNTRY_CODE,
  phoneNational: '',
  phone: '',
  contactPreferences: [],
  message: '',
};

const initialRoutePrivateDraft: RoutePrivateDraft = {
  travelMonth: '',
  datesFlexible: false,
  travelers: '',
  name: '',
  email: '',
  phoneCountry: DEFAULT_PHONE_COUNTRY_CODE,
  phoneNational: '',
  phone: '',
  message: '',
};

const customTravelerOptions = ['1 traveler', '2 travelers', '3-4 travelers', '5-8 travelers', '9+ travelers'];
const customTripLengthOptions = ['1-3 days', '4-6 days', '7-10 days', '11-14 days', '15+ days', 'Not sure yet'];
const customInterestOptions = [
  'Culture & history',
  'Nature',
  'Food',
  'Photography',
  'Family-friendly',
  'Local life',
  'Train travel',
  'Light hiking',
];
const customContactOptions = ['Email', 'WhatsApp', 'WhatsApp or email', 'Phone call'];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function savePendingGroupDraft(draft: GroupRequestDraft) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    pendingGroupDraftStorageKey,
    JSON.stringify({
      draft,
      savedAt: Date.now(),
    }),
  );
}

function consumePendingGroupDraft() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(pendingGroupDraftStorageKey);
    window.localStorage.removeItem(pendingGroupDraftStorageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { draft?: Partial<GroupRequestDraft>; savedAt?: number };
    if (!parsed.draft || !parsed.savedAt || Date.now() - parsed.savedAt > pendingGroupDraftMaxAgeMs) {
      return null;
    }

    return normalizeGroupDraft(parsed.draft);
  } catch {
    window.localStorage.removeItem(pendingGroupDraftStorageKey);
    return null;
  }
}

function hasCompleteGroupDraft(draft: GroupRequestDraft, departures: GroupTourDeparture[]) {
  return Boolean(
    draft.destinationSlug &&
      draft.routeSlug &&
      draft.departureId &&
      draft.adultQuantity >= 1 &&
      departures.some((departure) => departure.id === draft.departureId),
  );
}

function FilterRail<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="iosapp-filter-rail" role="tablist" aria-label="Filter results">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={cx('iosapp-filter-chip', value === option.key && 'is-active')}
          onClick={() => onChange(option.key)}
          role="tab"
          aria-selected={value === option.key}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AppHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <header className="iosapp-header">
      <div>
        <Link to="/" className="iosapp-header-brand">
          Syncing Travel
        </Link>
        {subtitle && subtitle !== 'Syncing Travel' ? <p>{subtitle}</p> : null}
        <h1>{title}</h1>
      </div>
      {trailing}
    </header>
  );
}

function SearchBar({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="iosapp-search" onSubmit={onSubmit} role="search">
      <Search size={18} />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search routes or destinations"
        className="iosapp-search-input"
      />
    </form>
  );
}

const CUSTOM_TRIP_HERO_FALLBACK_IMAGE = '/images/route-beijing-forbidden-01.png';

function CustomTripHero({ onOpenCustom }: { onOpenCustom: () => void }) {
  // routeTours can be empty when content fetch failed or DB has no published routes;
  // App still renders after ensureContentDataLoaded settles (success or failure).
  const spotlightRoute = routeTours.find((tour) => tour.featured) ?? routeTours[0];
  const heroImage = spotlightRoute?.image || CUSTOM_TRIP_HERO_FALLBACK_IMAGE;
  const heroAlt = spotlightRoute?.title || 'Custom China trip';

  return (
    <motion.section className="iosapp-custom-hero" aria-labelledby="custom-trip-title" variants={fadeUpItem}>
      <motion.button
        type="button"
        className="iosapp-custom-visual"
        onClick={onOpenCustom}
        whileTap={tapScaleSoft}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      >
        <img src={heroImage} alt={heroAlt} />
        <div className="iosapp-custom-shade" />
        <div className="iosapp-custom-copy">
          <span className="iosapp-pill">Private custom trip</span>
          <h2 id="custom-trip-title">Plan a China trip around you</h2>
          <p>Tell us your dates, pace, hotel style, and must-see places. A local planner builds the route with you.</p>
        </div>
      </motion.button>
      <motion.button
        type="button"
        className="iosapp-custom-cta"
        onClick={onOpenCustom}
        whileTap={tapScale}
      >
        <span>
          <Compass size={18} />
        </span>
        <div>
          <strong>Start custom trip planning</strong>
          <small>Best for private trips, families, couples, and friends</small>
        </div>
        <ChevronRight size={18} />
      </motion.button>
    </motion.section>
  );
}

function formatAdultPriceLabel(cents: number, currency: string) {
  return `$${(cents / 100).toFixed(0)} ${currency}`;
}

function GroupTourReserveCard({
  departures,
  loading,
  onOpenGroup,
  onOpenFeatured,
}: {
  departures: GroupTourDeparture[];
  loading: boolean;
  onOpenGroup: () => void;
  onOpenFeatured: (departureId: string) => void;
}) {
  const featured = departures.slice(0, 2);
  const hasFeatured = !loading && featured.length > 0;

  return (
    <motion.section className="iosapp-grouptour-card" aria-labelledby="grouptour-title" variants={fadeUpItem}>
      <div className="iosapp-grouptour-icon">
        <UsersRound size={20} />
      </div>
      <div className="iosapp-grouptour-copy">
        {hasFeatured ? (
          <>
            <span className="iosapp-kicker">Popular group tours</span>
            <h2 id="grouptour-title">Join a featured departure</h2>
          </>
        ) : (
          <>
            <span className="iosapp-kicker">Group tour</span>
            <h2 id="grouptour-title">Join a group tour</h2>
            {!loading ? (
              <p>
                Pick a guaranteed fixed departure, choose your adult seats, and pay the full amount to confirm your
                booking.
              </p>
            ) : null}
          </>
        )}
      </div>

      {loading ? (
        <p className="iosapp-grouptour-featured-empty">Loading featured...</p>
      ) : hasFeatured ? (
        <motion.div
          className="iosapp-grouptour-featured-list"
          variants={staggerListVariants}
          initial="initial"
          animate="animate"
        >
          {featured.map((departure) => {
            const route = getRouteBySlug(departure.routeSlug);
            const image = route?.image || '/images/route-beijing-forbidden-01.png';
            const title = route?.title || 'Group tour departure';

            return (
              <motion.button
                key={departure.id}
                type="button"
                className="iosapp-featured-group-card"
                onClick={() => onOpenFeatured(departure.id)}
                variants={listRowVariants}
                whileTap={tapScale}
              >
                <img src={image} alt="" />
                <span className="iosapp-featured-group-copy">
                  <strong>{title}</strong>
                  <small>{formatDepartureDateRange(departure)}</small>
                  <small>
                    {formatAdultPriceLabel(departure.adultPriceCents, departure.currency)} ·{' '}
                    {departure.spotsLeft} seats left
                  </small>
                </span>
                <ChevronRight size={18} aria-hidden />
              </motion.button>
            );
          })}
        </motion.div>
      ) : null}

      <motion.button type="button" className="iosapp-grouptour-button" onClick={onOpenGroup} whileTap={tapScale}>
        <span>{hasFeatured ? 'Find another departure' : 'Book a group tour'}</span>
        <ChevronRight size={18} />
      </motion.button>
    </motion.section>
  );
}

function FeaturedGroupDetailView({
  departure,
  onBack,
  onBook,
}: {
  departure: GroupTourDeparture;
  onBack: () => void;
  onBook: () => void;
}) {
  const route = getRouteBySlug(departure.routeSlug);
  const image = route?.image || '/images/route-beijing-forbidden-01.png';
  const title = route?.title || 'Group tour departure';
  const itinerary = route?.itinerarySummary ?? [];
  const destinationNames = route
    ? destinationMeta
        .filter((destination) => route.destinationSlugs.includes(destination.slug))
        .map((destination) => destination.name)
    : [];

  return (
    <motion.div
      className="china-trips-mobile-page iosapp-page iosapp-detail-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="iosapp-detail-hero iosapp-route-detail-hero">
        <img src={image} alt={title} />
        <div className="iosapp-detail-shade" />
        <nav className="iosapp-detail-nav" aria-label={`${title} navigation`}>
          <button type="button" onClick={onBack} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
        </nav>
        <div className="iosapp-detail-title">
          <span className="iosapp-pill">Featured group tour</span>
          <h1>{title}</h1>
          <p>{destinationNames.join(' · ') || route?.desc || departure.departureCity}</p>
        </div>
      </header>

      <main className="iosapp-detail-body">
        <section className="iosapp-detail-stats" aria-label="Departure facts">
          <span>
            <b>{formatDepartureDateRange(departure)}</b>
            dates
          </span>
          <span>
            <b>{formatAdultPriceLabel(departure.adultPriceCents, departure.currency)}</b>
            per adult
          </span>
          <span>
            <b>
              {departure.spotsLeft}/{departure.capacity}
            </b>
            seats left
          </span>
        </section>

        <section className="iosapp-featured-book-card" aria-label="Book this departure">
          <div>
            <h2>Ready to join?</h2>
            <p>Continue to the existing group tour booking flow with this departure selected.</p>
          </div>
          <button type="button" className="iosapp-grouptour-button" onClick={onBook}>
            <span>Book this departure</span>
            <ChevronRight size={18} />
          </button>
        </section>

        {route?.desc ? (
          <section className="iosapp-detail-section">
            <h2>Overview</h2>
            <div className="iosapp-route-copy">
              <p>{route.desc}</p>
            </div>
          </section>
        ) : null}

        {itinerary.length > 0 ? (
          <section className="iosapp-detail-section">
            <h2>Trip outline</h2>
            <div className="iosapp-day-list">
              {itinerary.map((item, index) => (
                <article key={`${item}-${index}`} className="iosapp-day-card">
                  <span className="iosapp-day-index">{index + 1}</span>
                  <div>
                    <h3>Day focus {index + 1}</h3>
                    <p>{item}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {departure.includedItems.length > 0 ? (
          <section className="iosapp-detail-section">
            <h2>Included</h2>
            <ul className="iosapp-featured-list">
              {departure.includedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </motion.div>
  );
}

const POPULAR_PLACES_COUNT = 6;

function getPopularPlaces(): typeof destinationMeta {
  const featured = destinationMeta
    .filter((destination) => destination.featuredOnHome)
    .sort((a, b) => a.featuredPriority - b.featuredPriority);

  if (featured.length >= POPULAR_PLACES_COUNT) {
    return featured.slice(0, POPULAR_PLACES_COUNT);
  }

  const featuredSlugs = new Set(featured.map((destination) => destination.slug));
  const backfill = destinationMeta
    .filter((destination) => !featuredSlugs.has(destination.slug))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return [...featured, ...backfill].slice(0, POPULAR_PLACES_COUNT);
}

function DestinationGrid({
  onSelectTab,
  onOpenPlace,
}: {
  onSelectTab: (tab: MobileTab) => void;
  onOpenPlace: (slug: string) => void;
}) {
  return (
    <motion.section className="iosapp-section" variants={fadeUpItem}>
      <div className="iosapp-section-head">
        <h2>Popular places</h2>
        <button type="button" onClick={() => onSelectTab('destinations')}>
          View all
        </button>
      </div>
      <motion.div className="iosapp-destination-grid" variants={staggerListVariants}>
        {getPopularPlaces().map((destination) => {
          const routeCount = routeTours.filter((tour) => tour.destinationSlugs.includes(destination.slug)).length;

          return (
            <motion.div key={destination.slug} variants={listRowVariants} whileTap={tapScaleSoft}>
              <MobileDestinationCard
                image={destination.image}
                name={destination.name}
                routeCount={routeCount}
                onClick={() => onOpenPlace(destination.slug)}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </motion.section>
  );
}

function FeaturedRouteCards({
  onSelectTab,
  onOpenRoute,
}: {
  onSelectTab: (tab: MobileTab) => void;
  onOpenRoute: (slug: string) => void;
}) {
  const featuredRoutes = routeTours.filter((tour) => tour.featured).slice(0, 5);

  return (
    <motion.section className="iosapp-section" variants={fadeUpItem}>
      <div className="iosapp-section-head">
        <h2>Browse routes</h2>
        <button type="button" onClick={() => onSelectTab('routes')}>
          View all
        </button>
      </div>
      <motion.div className="iosapp-feature-rail" variants={staggerListVariants}>
        {featuredRoutes.map((tour) => (
          <motion.button
            key={tour.slug}
            type="button"
            className="iosapp-feature-card"
            onClick={() => onOpenRoute(tour.slug)}
            variants={listRowVariants}
            whileTap={tapScaleSoft}
          >
            <img src={tour.image} alt={tour.title} />
            {tour.category ? <span className="iosapp-pill">{tour.category}</span> : null}
            <div>
              <strong>{tour.title}</strong>
              <small>
                {tour.duration} · {tour.groupSize}
              </small>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </motion.section>
  );
}

/** Same real Syncing assets as desktop Home Real Moments (subset for mobile). */
const homeRealMomentCards: Array<{ image: string; title: string; place?: string }> = [
  {
    image: '/images/syncing-real-place-great-wall-group.png',
    title: 'Great Wall',
    place: 'Beijing',
  },
  {
    image: '/images/syncing-real-place-jiuzhaigou-lake.jpg',
    title: 'Jiuzhaigou Valley',
    place: 'Sichuan',
  },
  {
    image: '/images/syncing-real-place-guilin-river.png',
    title: 'Li River',
    place: 'Guilin',
  },
  {
    image: '/images/syncing-real-traveler-group-dinner.jpg',
    title: 'Group Dinner',
  },
  {
    image: '/images/syncing-real-traveler-bund-friends.jpg',
    title: 'Bund Evening',
  },
  {
    image: '/images/syncing-real-traveler-chongqing-night.jpg',
    title: 'Chongqing Night Walk',
  },
];

function scoreMobileSearchHit(normalized: string, title: string, keywords: string[], haystackParts: string[]) {
  const titleLower = title.toLowerCase();
  const keywordHit = keywords.some((keyword) => keyword.toLowerCase().includes(normalized));
  const haystack = haystackParts.join(' ').toLowerCase();

  return (
    (titleLower.includes(normalized) ? 5 : 0) +
    (keywordHit ? 3 : 0) +
    (haystack.includes(normalized) ? 1 : 0)
  );
}

/** Mini-App search: destinations + routes only; opens in-app detail, not desktop /search hrefs. */
function searchMobileContent(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return { destinations: [] as typeof destinationMeta, routes: [] as typeof routeTours };
  }

  const destinations = destinationMeta
    .map((destination) => {
      const keywords = [destination.name, destination.slug, ...destination.travelStyles];
      const score = scoreMobileSearchHit(normalized, destination.name, keywords, [
        destination.name,
        destination.description,
        destination.slug,
        ...destination.travelStyles,
      ]);
      return { destination, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ destination }) => destination);

  const routes = routeTours
    .map((tour) => {
      const keywords = [tour.category, tour.duration, tour.groupSize, tour.slug, ...tour.themes, ...tour.destinationSlugs];
      const score = scoreMobileSearchHit(normalized, tour.title, keywords, [
        tour.title,
        tour.desc,
        tour.slug,
        tour.category,
        ...tour.themes,
        ...tour.destinationSlugs,
      ]);
      return { tour, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ tour }) => tour);

  return { destinations, routes };
}

function RealMomentsSection() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const activeCard = lightboxIndex === null ? null : homeRealMomentCards[lightboxIndex];

  useEffect(() => {
    if (lightboxIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null);
        return;
      }
      if (event.key === 'ArrowLeft') {
        setLightboxIndex((current) =>
          current === null ? null : (current - 1 + homeRealMomentCards.length) % homeRealMomentCards.length,
        );
        return;
      }
      if (event.key === 'ArrowRight') {
        setLightboxIndex((current) => (current === null ? null : (current + 1) % homeRealMomentCards.length));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex]);

  return (
    <motion.section className="iosapp-section" aria-labelledby="real-moments-title" variants={fadeUpItem}>
      <div className="iosapp-section-head">
        <h2 id="real-moments-title">Real moments</h2>
      </div>
      <p className="iosapp-moments-subtitle">From our travelers across China</p>
      <div className="iosapp-moments-rail" role="list">
        {homeRealMomentCards.map((card, index) => (
          <motion.button
            key={card.image}
            type="button"
            className="iosapp-moments-card"
            role="listitem"
            aria-label={`View ${card.title}${card.place ? `, ${card.place}` : ''}`}
            onClick={() => setLightboxIndex(index)}
            whileTap={tapScaleSoft}
          >
            <img src={card.image} alt="" />
            <span className="iosapp-moments-caption">
              <strong>{card.title}</strong>
              {card.place ? <small>{card.place}</small> : null}
            </span>
          </motion.button>
        ))}
      </div>

      {activeCard ? (
        <div
          className="iosapp-moments-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeCard.title} photo`}
        >
          <button
            type="button"
            className="iosapp-moments-lightbox-backdrop"
            aria-label="Close photo"
            onClick={() => setLightboxIndex(null)}
          />
          <div className="iosapp-moments-lightbox-panel">
            <header className="iosapp-moments-lightbox-bar">
              <button type="button" onClick={() => setLightboxIndex(null)} aria-label="Close">
                <X size={22} />
              </button>
              <div>
                <strong>{activeCard.title}</strong>
                {activeCard.place ? <small>{activeCard.place}</small> : null}
              </div>
              <span />
            </header>
            <div className="iosapp-moments-lightbox-stage">
              <button
                type="button"
                className="iosapp-moments-lightbox-nav"
                aria-label="Previous photo"
                onClick={() =>
                  setLightboxIndex((current) =>
                    current === null ? null : (current - 1 + homeRealMomentCards.length) % homeRealMomentCards.length,
                  )
                }
              >
                <ChevronLeft size={28} />
              </button>
              <img src={activeCard.image} alt={activeCard.title} />
              <button
                type="button"
                className="iosapp-moments-lightbox-nav"
                aria-label="Next photo"
                onClick={() =>
                  setLightboxIndex((current) =>
                    current === null ? null : (current + 1) % homeRealMomentCards.length,
                  )
                }
              >
                <ChevronRight size={28} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}

function SearchResultsView({
  query,
  onQueryChange,
  onSearch,
  onBack,
  onOpenPlace,
  onOpenRoute,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onOpenPlace: (slug: string) => void;
  onOpenRoute: (slug: string) => void;
}) {
  const { destinations, routes } = useMemo(() => searchMobileContent(query), [query]);
  const trimmed = query.trim();
  const hasResults = destinations.length > 0 || routes.length > 0;

  return (
    <motion.div
      className="china-trips-mobile-page iosapp-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <BackBar title="Search" onBack={onBack} />
      <main className="iosapp-screen iosapp-search-results-screen">
        <SearchBar value={query} onChange={onQueryChange} onSubmit={onSearch} />

        {!trimmed ? (
          <p className="iosapp-search-empty">Search destinations or routes to explore inside the app.</p>
        ) : !hasResults ? (
          <p className="iosapp-search-empty">No matches for "{trimmed}". Try another place or route name.</p>
        ) : (
          <>
            {destinations.length > 0 ? (
              <section className="iosapp-search-group" aria-labelledby="search-destinations-title">
                <h2 id="search-destinations-title">Destinations</h2>
                <div className="iosapp-card-list">
                  {destinations.map((destination) => (
                    <MobileDestinationListRow
                      key={destination.slug}
                      image={destination.image}
                      name={destination.name}
                      description={destination.description}
                      onClick={() => onOpenPlace(destination.slug)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {routes.length > 0 ? (
              <section className="iosapp-search-group" aria-labelledby="search-routes-title">
                <h2 id="search-routes-title">Routes</h2>
                <div className="iosapp-card-list">
                  {routes.map((tour) => (
                    <MobileRouteListCard
                      key={tour.slug}
                      image={tour.image}
                      title={tour.title}
                      meta={[tour.duration, tour.category].filter(Boolean).join(' · ')}
                      onClick={() => onOpenRoute(tour.slug)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </motion.div>
  );
}

function HomeTab({
  query,
  onQueryChange,
  onSearch,
  onOpenCustom,
  onOpenGroup,
  onOpenFeaturedGroup,
  featuredDepartures,
  featuredLoading,
  onOpenPlace,
  onOpenRoute,
  onSelectTab,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCustom: () => void;
  onOpenGroup: () => void;
  onOpenFeaturedGroup: (departureId: string) => void;
  featuredDepartures: GroupTourDeparture[];
  featuredLoading: boolean;
  onOpenPlace: (slug: string) => void;
  onOpenRoute: (slug: string) => void;
  onSelectTab: (tab: MobileTab) => void;
}) {
  return (
    <motion.div variants={tabPanelVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={fadeUpItem}>
        <AppHeader title="Plan your China trip" subtitle="Syncing Travel" />
      </motion.div>
      <motion.div variants={fadeUpItem}>
        <SearchBar value={query} onChange={onQueryChange} onSubmit={onSearch} />
      </motion.div>

      <CustomTripHero onOpenCustom={onOpenCustom} />

      <GroupTourReserveCard
        departures={featuredDepartures}
        loading={featuredLoading}
        onOpenGroup={onOpenGroup}
        onOpenFeatured={onOpenFeaturedGroup}
      />

      <DestinationGrid onSelectTab={onSelectTab} onOpenPlace={onOpenPlace} />

      <FeaturedRouteCards onSelectTab={onSelectTab} onOpenRoute={onOpenRoute} />

      <RealMomentsSection />
    </motion.div>
  );
}

function DestinationsTab({ onOpenPlace }: { onOpenPlace: (slug: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeFilter, setActiveFilter] = useState<PlaceFilterKey>(ALL_FILTER_KEY);

  useEffect(() => {
    let cancelled = false;
    fetchCategories('destination')
      .then((result) => {
        if (cancelled) return;
        setCategories(result);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedFilter = categories.find((filter) => filter.key === activeFilter);
  const destinations =
    activeFilter !== ALL_FILTER_KEY && selectedFilter
      ? destinationMeta.filter((destination) => destination.travelStyles.includes(activeFilter))
      : destinationMeta;

  const filterOptions = [
    { key: ALL_FILTER_KEY, label: 'All' },
    ...categories.map((category) => ({ key: category.key, label: category.label })),
  ];

  return (
    <motion.div variants={tabPanelVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={fadeUpItem}>
        <AppHeader title="Destinations" subtitle="Explore China" />
      </motion.div>
      {categories.length > 0 && (
        <motion.div variants={fadeUpItem}>
          <FilterRail options={filterOptions} value={activeFilter} onChange={setActiveFilter} />
        </motion.div>
      )}
      <motion.p className="iosapp-filter-summary" variants={fadeUpItem}>
        {destinations.length} place{destinations.length === 1 ? '' : 's'}
        {selectedFilter ? ` in ${selectedFilter.label}` : ''}
      </motion.p>
      <motion.div
        key={activeFilter}
        className="iosapp-card-list"
        variants={staggerListVariants}
        initial="initial"
        animate="animate"
      >
        {destinations.map((destination) => (
          <motion.div key={destination.slug} variants={listRowVariants} whileTap={tapScale}>
            <MobileDestinationListRow
              image={destination.image}
              name={destination.name}
              description={destination.description}
              onClick={() => onOpenPlace(destination.slug)}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function RoutesTab({ onOpenRoute }: { onOpenRoute: (slug: string) => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeFilter, setActiveFilter] = useState<RouteFilterKey>(ALL_FILTER_KEY);

  useEffect(() => {
    let cancelled = false;
    fetchCategories('route')
      .then((result) => {
        if (cancelled) return;
        setCategories(result);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedFilter = categories.find((filter) => filter.key === activeFilter);
  const filteredRoutes =
    activeFilter !== ALL_FILTER_KEY && selectedFilter
      ? routeTours.filter((tour) => tour.themes.includes(activeFilter))
      : routeTours;

  const filterOptions = [
    { key: ALL_FILTER_KEY, label: 'All' },
    ...categories.map((category) => ({ key: category.key, label: category.label })),
  ];

  return (
    <motion.div variants={tabPanelVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={fadeUpItem}>
        <AppHeader title="Routes" subtitle="Existing route library" />
      </motion.div>
      {categories.length > 0 && (
        <motion.div variants={fadeUpItem}>
          <FilterRail options={filterOptions} value={activeFilter} onChange={setActiveFilter} />
        </motion.div>
      )}
      <motion.p className="iosapp-filter-summary" variants={fadeUpItem}>
        {filteredRoutes.length} route{filteredRoutes.length === 1 ? '' : 's'}
        {selectedFilter ? ` in ${selectedFilter.label}` : ''}
      </motion.p>
      <motion.div
        key={activeFilter}
        className="iosapp-card-list"
        variants={staggerListVariants}
        initial="initial"
        animate="animate"
      >
        {filteredRoutes.map((tour) => (
          <motion.div key={tour.slug} variants={listRowVariants} whileTap={tapScale}>
            <MobileRouteListCard
              image={tour.image}
              title={tour.title}
              meta={[tour.category, tour.duration, tour.groupSize].filter(Boolean).join(' · ')}
              onClick={() => onOpenRoute(tour.slug)}
            />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

function PlaceDetailView({
  destination,
  tours,
  onBack,
  onOpenRoute,
  onOpenCustom,
  onOpenGroup,
}: {
  destination: (typeof destinationMeta)[number];
  tours: typeof routeTours;
  onBack: () => void;
  onOpenRoute: (slug: string) => void;
  onOpenCustom: () => void;
  onOpenGroup: () => void;
}) {
  const routeCount = tours.length;
  const bestFor = getPlaceBestFor(destination.slug);

  return (
    <motion.div
      className="china-trips-mobile-page iosapp-page iosapp-detail-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="iosapp-detail-hero">
        <img src={destination.image} alt={destination.name} />
        <div className="iosapp-detail-shade" />
        <nav className="iosapp-detail-nav" aria-label={`${destination.name} navigation`}>
          <button type="button" onClick={onBack} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <button type="button" onClick={onOpenCustom}>Plan</button>
        </nav>
        <div className="iosapp-detail-title">
          <span className="iosapp-pill">{bestFor}</span>
          <h1>{destination.name}</h1>
          <p>{destination.description}</p>
        </div>
      </header>

      <main className="iosapp-detail-body">
        <section className="iosapp-detail-stats" aria-label={`${destination.name} travel summary`}>
          <span>
            <b>{routeCount}</b>
            routes
          </span>
          <span>
            <b>{getPlacePace(destination.slug)}</b>
            pace
          </span>
          <span>
            <b>{getPlaceSeason(destination.slug)}</b>
            season
          </span>
        </section>

        <section className="iosapp-detail-section">
          <h2>Why travelers choose it</h2>
          <p>{getPlaceWhy(destination.slug)}</p>
        </section>

        <section className="iosapp-detail-section">
          <div className="iosapp-section-head">
            <h2>Routes from {destination.name}</h2>
          </div>
          <div className="iosapp-card-list">
            {tours.slice(0, 4).map((tour) => (
              <MobileRouteListCard
                key={tour.slug}
                image={tour.image}
                title={tour.title}
                meta={[tour.category, tour.duration, tour.groupSize].filter(Boolean).join(' · ')}
                onClick={() => onOpenRoute(tour.slug)}
              />
            ))}
          </div>
        </section>

        <section className="iosapp-detail-section iosapp-grouped-card">
          <h2>Good to know</h2>
          <div className="iosapp-detail-lines">
            <span>
              <MapPin size={18} />
              <b>Best for</b>
              <small>{bestFor}</small>
            </span>
            <span>
              <CalendarDays size={18} />
              <b>Timing</b>
              <small>{getPlaceTiming(destination.slug)}</small>
            </span>
            <span>
              <ShieldCheck size={18} />
              <b>Planning note</b>
              <small>{getPlacePlanningNote(destination.slug)}</small>
            </span>
          </div>
        </section>

        <div className="iosapp-detail-actions">
          <button type="button" className="iosapp-primary-button" onClick={onOpenCustom}>
            Plan private trip
          </button>
          <button type="button" className="iosapp-secondary-button" onClick={onOpenGroup}>
            Join a group tour
          </button>
        </div>
      </main>
    </motion.div>
  );
}

function RouteDetailView({
  tour,
  onBack,
  onOpenCustom,
  onOpenGroup,
}: {
  tour: (typeof routeTours)[number];
  onBack: () => void;
  onOpenCustom: () => void;
  onOpenGroup: () => void;
}) {
  const routeDetail = tour.structuredItinerary
    ? buildMobileStructuredDetail(tour, tour.structuredItinerary)
    : getRoutePdfDetail(tour.id) ?? buildMobileFallbackDetail(tour);
  const destinationNames = getRouteDestinationNames(tour);

  return (
    <motion.div
      className="china-trips-mobile-page iosapp-page iosapp-detail-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <header className="iosapp-detail-hero iosapp-route-detail-hero">
        <img src={tour.image} alt={tour.title} />
        <div className="iosapp-detail-shade" />
        <nav className="iosapp-detail-nav" aria-label={`${tour.title} navigation`}>
          <button type="button" onClick={onBack} aria-label="Back">
            <ChevronLeft size={24} />
          </button>
          <button type="button" onClick={onOpenCustom}>Plan</button>
        </nav>
        <div className="iosapp-detail-title">
          {tour.category ? <span className="iosapp-pill">{tour.category}</span> : null}
          <h1>{tour.title}</h1>
          <p>{destinationNames.join(' · ') || tour.desc}</p>
        </div>
      </header>

      <main className="iosapp-detail-body">
        <section className="iosapp-detail-stats" aria-label={`${tour.title} quick facts`}>
          <span>
            <b>{tour.duration}</b>
            duration
          </span>
          <span>
            <b>{tour.groupSize}</b>
            format
          </span>
          <span>
            <b>TBC</b>
            final price
          </span>
        </section>

        <section className="iosapp-route-booking-card" aria-label="Booking options for this route">
          <div className="iosapp-route-booking-head">
            <h2>Book this route</h2>
            <p>Choose the travel style that fits your group.</p>
          </div>
          <div className="iosapp-route-booking-actions">
            <button type="button" className="iosapp-route-booking-option is-primary" onClick={onOpenGroup}>
              <span>
                <UsersRound size={19} />
                Group tour
              </span>
              <b>Join a group tour</b>
              <small>Full payment · guaranteed fixed departure</small>
            </button>
            <button type="button" className="iosapp-route-booking-option" onClick={onOpenCustom}>
              <span>
                <Compass size={19} />
                Private trip
              </span>
              <b>Plan private trip</b>
              <small>Based on this route</small>
            </button>
          </div>
        </section>

        <section className="iosapp-detail-section">
          <h2>Overview</h2>
          <div className="iosapp-route-copy">
            {routeDetail.experience.map((item) => (
              <p key={item}>{cleanRouteDetailText(item)}</p>
            ))}
          </div>
        </section>

        <section className="iosapp-detail-section">
          <h2>Day-by-day itinerary</h2>
          <div className="iosapp-day-list">
            {routeDetail.days.map((day, index) => (
              <article key={`${day.title}-${index}`} className="iosapp-day-card">
                <span className="iosapp-day-index">{index + 1}</span>
                <div>
                  <h3>{day.title}</h3>
                  <p>{day.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="iosapp-detail-section">
          <h2>Signature moments</h2>
          <div className="iosapp-moment-grid">
            {routeDetail.moments.map((moment) => (
              <span key={moment} className="iosapp-moment-chip">
                <Star size={16} />
                {moment}
              </span>
            ))}
          </div>
        </section>

        <section className="iosapp-detail-section iosapp-grouped-card">
          <h2>Included</h2>
          <div className="iosapp-detail-lines">
            {routeDetail.included.map((item) => (
              <span key={item}>
                <ShieldCheck size={18} />
                <b>{item.split(' ').slice(0, 3).join(' ')}</b>
                <small>{item}</small>
              </span>
            ))}
          </div>
        </section>
      </main>
    </motion.div>
  );
}

function RoutePrivateRequestView({
  tour,
  draft,
  status,
  fieldErrors,
  formError,
  message,
  hint,
  turnstileResetSignal,
  preferenceFields,
  preferences,
  configLoading,
  configError,
  onBack,
  onFieldChange,
  onDatesFlexibleChange,
  onPhoneChange,
  onPreferenceChange,
  onTurnstileToken,
  onSubmit,
}: {
  tour: (typeof routeTours)[number];
  draft: RoutePrivateDraft;
  status: CustomSubmitStatus;
  fieldErrors: FieldErrors;
  formError: string;
  message: string;
  hint: string;
  turnstileResetSignal: number;
  preferenceFields: CustomTripFormField[];
  preferences: CustomPreferences;
  configLoading: boolean;
  configError: string;
  onBack: () => void;
  onFieldChange: (field: Exclude<keyof RoutePrivateDraft, 'datesFlexible'>, value: string) => void;
  onDatesFlexibleChange: (flexible: boolean) => void;
  onPhoneChange: (countryCode: string, nationalNumber: string) => void;
  onPreferenceChange: (fieldKey: string, value: unknown) => void;
  onTurnstileToken: (token: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isSubmitting = status === 'loading';
  const destinationNames = getRouteDestinationNames(tour);
  const basicFields = useMemo(
    () => preferenceFieldsForRoutePrivate(preferenceFields),
    [preferenceFields],
  );
  const durationDays =
    tour.durationDays > 0
      ? tour.durationDays
      : Number.parseInt(tour.duration, 10) || 0;
  const suggestedEnd = draft.travelMonth && durationDays
    ? endDateFromDuration(draft.travelMonth, durationDays)
    : '';

  return (
    <div className="china-trips-mobile-page iosapp-page">
      <BackBar title="Private trip" onBack={onBack} />
      <main className="iosapp-screen">
        <header className="iosapp-flow-intro">
          <span className="iosapp-kicker">Based on this route</span>
          <h1>Private trip based on this route</h1>
          <p>Share your dates and group size. A planner will customize this itinerary for you.</p>
        </header>

        <section className="iosapp-grouped-card iosapp-custom-intro" aria-label="Selected route">
          <span className="iosapp-kicker">{tour.duration}</span>
          <h2>{tour.title}</h2>
          <p>{destinationNames.join(' · ') || tour.desc}</p>
        </section>

        {hint && (
          <div className="iosapp-form-message" role="status">
            <p>{hint}</p>
          </div>
        )}

        <form className="iosapp-form iosapp-custom-form" onSubmit={onSubmit} noValidate>
          <input type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" hidden />

          <section className="iosapp-form-section">
            <h2>Travel basics</h2>
            <div data-field-error="timing" className={cx(fieldErrors.timing && 'iosapp-timing-group is-invalid')}>
              <label className={cx('iosapp-input-row', fieldErrors.timing && 'is-invalid')}>
                <span>Preferred start date{draft.datesFlexible ? '' : ' *'}</span>
                <Input
                  type="date"
                  value={draft.travelMonth}
                  onChange={(event) => onFieldChange('travelMonth', event.target.value)}
                  disabled={draft.datesFlexible || isSubmitting}
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.timing)}
                  aria-describedby={fieldErrors.timing ? fieldErrorId('timing') : undefined}
                />
              </label>
              {suggestedEnd && !draft.datesFlexible && (
                <p className="iosapp-pref-hint" role="status">
                  Suggested end date: <b>{suggestedEnd}</b>
                  {durationDays > 0 ? ` (${durationDays}-day route)` : ''}
                </p>
              )}
              <label className={cx('iosapp-choice-chip', draft.datesFlexible && 'is-selected')}>
                <input
                  type="checkbox"
                  checked={draft.datesFlexible}
                  onChange={(event) => onDatesFlexibleChange(event.target.checked)}
                  disabled={isSubmitting}
                />
                <b>Dates are flexible</b>
              </label>
              <label className={cx('iosapp-select-row', fieldErrors.timing && 'is-invalid')}>
                <span>Travelers *</span>
                <select
                  value={draft.travelers}
                  onChange={(event) => onFieldChange('travelers', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.timing)}
                >
                  <option value="">Select</option>
                  {customTravelerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <FieldHint id={fieldErrorId('timing')} message={fieldErrors.timing} />
            </div>
            <label className="iosapp-input-row iosapp-textarea-row">
              <span>How would you like to change this route?</span>
              <textarea
                value={draft.message}
                onChange={(event) => onFieldChange('message', event.target.value)}
                placeholder="Optional: pace, hotels, skip a day, add a side trip"
              />
            </label>
          </section>

          <section className="iosapp-form-section">
            <h2>Preferences</h2>
            {configLoading && <p className="iosapp-pref-status">Loading preference options...</p>}
            {configError && <p className="iosapp-form-error" role="alert">{configError}</p>}
            {!configLoading && !configError && (
              <CustomTripPreferenceSections
                basicFields={basicFields}
                moreFields={[]}
                values={preferences}
                errors={fieldErrors}
                moreOpen={false}
                onMoreOpenChange={() => {}}
                variant="mobile"
                onChange={onPreferenceChange}
              />
            )}
          </section>

          <section className="iosapp-form-section">
            <h2>Contact</h2>
            <label className={cx('iosapp-input-row', fieldErrors.name && 'is-invalid')} data-field-error="name">
              <span>Name *</span>
              <Input
                value={draft.name}
                onChange={(event) => onFieldChange('name', event.target.value)}
                placeholder="Full name"
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
              />
            </label>
            <FieldHint id={fieldErrorId('name')} message={fieldErrors.name} />
            <label className={cx('iosapp-input-row', fieldErrors.email && 'is-invalid')} data-field-error="email">
              <span>Email *</span>
              <Input
                value={draft.email}
                onChange={(event) => onFieldChange('email', event.target.value)}
                placeholder="you@example.com"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? fieldErrorId('email') : undefined}
              />
            </label>
            <FieldHint id={fieldErrorId('email')} message={fieldErrors.email} />
            <PhoneCountryField
              countryCode={draft.phoneCountry}
              nationalNumber={draft.phoneNational}
              error={fieldErrors.phone}
              onCountryChange={(code) => onPhoneChange(code, draft.phoneNational)}
              onNationalChange={(value) => onPhoneChange(draft.phoneCountry, value)}
            />
            <div
              className={cx('iosapp-turnstile-row', fieldErrors.turnstile && 'is-invalid')}
              data-field-error="turnstile"
            >
              <TurnstileWidget onTokenChange={onTurnstileToken} resetSignal={turnstileResetSignal} />
              <FieldHint id={fieldErrorId('turnstile')} message={fieldErrors.turnstile} />
            </div>
          </section>

          {formError && (
            <div className="iosapp-form-error" role="alert">
              <p>{formError}</p>
            </div>
          )}
          {message && <p className="iosapp-form-message">{message}</p>}

          <Button
            type="submit"
            variant="ghost"
            className="iosapp-primary-button"
            disabled={isSubmitting || configLoading || Boolean(configError)}
          >
            {isSubmitting ? 'Sending request...' : 'Send private trip request'}
          </Button>
        </form>
      </main>
    </div>
  );
}

function buildMobileStructuredDetail(
  tour: (typeof routeTours)[number],
  structured: NonNullable<(typeof routeTours)[number]['structuredItinerary']>,
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

function buildMobileFallbackDetail(tour: (typeof routeTours)[number]): RoutePdfDetail {
  return {
    source: 'Current route library',
    tourCode: `ST-${String(tour.id).padStart(3, '0')}`,
    experience: [tour.desc, ...tour.highlights],
    moments: tour.highlights.slice(0, 3),
    days: tour.itinerarySummary.map((item, index) => ({
      title: `Day ${index + 1}`,
      text: item,
    })),
    included: tour.includedSupport,
    notes: [
      'Final day order, hotels, guides, trains, flights, and price are confirmed after dates and group size are shared.',
    ],
  };
}

function getRouteBySlug(slug: string) {
  return routeTours.find((tour) => tour.slug === slug);
}

function getDepartureDestinationFilters(departures: GroupTourDeparture[]) {
  const destinationSlugs = new Set<string>();

  departures.forEach((departure) => {
    getRouteBySlug(departure.routeSlug)?.destinationSlugs.forEach((slug) => destinationSlugs.add(slug));
  });

  return [
    { key: 'all', label: 'All places' },
    ...destinationMeta
      .filter((destination) => destinationSlugs.has(destination.slug))
      .map((destination) => ({
        key: destination.slug,
        label: destination.name,
      })),
  ];
}

function formatDepartureDay(value: string) {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function formatDepartureMonth(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function formatDepartureMonthYear(value: string) {
  const dateOnly = normalizeDateOnly(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateOnly}T00:00:00Z`));
}

function formatDepartureDateRange(departure: Pick<GroupTourDeparture, 'startDate' | 'endDate'>) {
  const startOnly = normalizeDateOnly(departure.startDate);
  const endOnly = normalizeDateOnly(departure.endDate);
  const start = new Date(`${startOnly}T00:00:00Z`);
  const end = new Date(`${endOnly}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return endOnly ? `${startOnly || departure.startDate} – ${endOnly || departure.endDate}` : startOnly || departure.startDate;
  }

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  const startMonth = monthFormat.format(start);
  const endMonth = monthFormat.format(end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (sameYear && sameMonth) return `${startMonth} ${startDay}-${endDay}, ${startYear}`;
  if (sameYear) return `${startMonth} ${startDay}-${endMonth} ${endDay}, ${startYear}`;

  return `${startMonth} ${startDay}, ${startYear}-${endMonth} ${endDay}, ${endYear}`;
}

function groupDeparturesByMonth(departures: GroupTourDeparture[]) {
  const groups: Array<{ key: string; label: string; departures: GroupTourDeparture[] }> = [];

  departures.forEach((departure) => {
    const key = normalizeDateOnly(departure.startDate).slice(0, 7);
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.departures.push(departure);
      return;
    }

    groups.push({
      key,
      label: formatDepartureMonthYear(departure.startDate),
      departures: [departure],
    });
  });

  return groups;
}

function getRouteDestinationNames(tour: (typeof routeTours)[number]) {
  const names: string[] = [];

  tour.destinationSlugs.forEach((slug) => {
    const destination = destinationMeta.find((item) => item.slug === slug);
    if (destination) names.push(destination.name);
  });

  return names;
}

function cleanRouteDetailText(text: string) {
  return text
    .replace(/\s*built from the original route PDF/gi, '')
    .replace(/\s*from the PDF/gi, '')
    .replace(/The PDF route combines/gi, 'This route combines')
    .replace(/The PDF route includes/gi, 'This route includes')
    .replace(/The PDF is/gi, 'This is')
    .replace(/The PDF emphasizes/gi, 'This route emphasizes')
    .replace(/The original PDF centers on/gi, 'This route centers on')
    .replace(/The extracted PDF itinerary includes/gi, 'The itinerary includes')
    .replace(/extracted from the PDF,\s*/gi, '')
    .replace(/\bPDF\b/gi, 'itinerary');
}

function FieldHint({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="iosapp-field-error" role="alert">
      {message}
    </p>
  );
}

function AnonymousJoinedAvatar({ index }: { index: number }) {
  return (
    <span
      className="iosapp-traveler-avatar is-anonymous"
      aria-hidden="true"
      style={{ ['--avatar-hue' as string]: String((index * 47) % 360) }}
    >
      <UserRound size={18} strokeWidth={2.25} />
    </span>
  );
}

function DepartureJoinedRoster({
  departure,
}: {
  departure?: GroupTourDeparture;
}) {
  if (!departure) {
    return (
      <div className="iosapp-joined-roster is-empty">
        <p>Select a departure to see who has already joined.</p>
      </div>
    );
  }

  const booked = Math.max(0, departure.capacity - departure.spotsLeft);
  const visible = Math.min(booked, departure.capacity);

  return (
    <div
      className="iosapp-joined-roster"
      aria-label={`${booked} of ${departure.capacity} travelers already joined this departure`}
    >
      {visible > 0 ? (
        <div className="iosapp-traveler-avatars" aria-hidden="true">
          {Array.from({ length: visible }, (_, index) => (
            <AnonymousJoinedAvatar key={`joined-${departure.id}-${index}`} index={index} />
          ))}
        </div>
      ) : (
        <div className="iosapp-joined-roster-empty" aria-hidden="true">
          <span className="iosapp-traveler-avatar is-anonymous is-ghost">
            <UserRound size={18} strokeWidth={2.25} />
          </span>
        </div>
      )}
      <p>
        {booked > 0
          ? `${booked} of ${departure.capacity} already joined · ${departure.spotsLeft} seats left`
          : `No one booked yet · ${departure.spotsLeft} of ${departure.capacity} seats open`}
      </p>
    </div>
  );
}

function PhoneCountryField({
  countryCode,
  nationalNumber,
  error,
  onCountryChange,
  onNationalChange,
}: {
  countryCode: string;
  nationalNumber: string;
  error?: string;
  onCountryChange: (code: string) => void;
  onNationalChange: (value: string) => void;
}) {
  const country = getPhoneCountry(countryCode);
  const [pickerOpen, setPickerOpen] = useState(false);
  const nationalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickerOpen]);

  const selectCountry = (code: string) => {
    onCountryChange(code);
    setPickerOpen(false);
    nationalInputRef.current?.focus();
  };

  return (
    <div
      className={cx('iosapp-phone-field', error && 'is-invalid')}
      data-field-error="phone"
    >
      <span className="iosapp-phone-label">WhatsApp / phone</span>
      <div className="iosapp-phone-controls">
        <button
          type="button"
          className="iosapp-phone-country"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
          aria-label={`Phone country or region, +${country.dial} ${country.name}`}
        >
          <img src={country.flagSrc} alt="" width={24} height={18} loading="lazy" />
          <span className="iosapp-phone-country-dial">+{country.dial}</span>
          <ChevronDown size={16} aria-hidden />
        </button>
        <Input
          ref={nationalInputRef}
          value={nationalNumber}
          onChange={(event) => onNationalChange(event.target.value)}
          placeholder="Local number"
          inputMode="tel"
          autoComplete="tel-national"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? fieldErrorId('phone') : undefined}
        />
      </div>
      <FieldHint id={fieldErrorId('phone')} message={error} />

      {pickerOpen ? (
        <div className="iosapp-sheet-root" role="presentation">
          <button
            type="button"
            className="iosapp-sheet-backdrop"
            aria-label="Close country picker"
            onClick={() => setPickerOpen(false)}
          />
          <div
            className="iosapp-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="phone-country-picker-title"
          >
            <header className="iosapp-sheet-header">
              <div>
                <span className="iosapp-kicker">WhatsApp / phone</span>
                <h2 id="phone-country-picker-title">Country / region</h2>
              </div>
              <button
                type="button"
                className="iosapp-sheet-close"
                onClick={() => setPickerOpen(false)}
                aria-label="Close"
              >
                Close
              </button>
            </header>
            <div className="iosapp-sheet-body">
              <div className="iosapp-country-list" role="listbox" aria-label="Country or region">
                {PHONE_COUNTRIES.map((option) => {
                  const selected = option.code === countryCode;

                  return (
                    <button
                      key={option.code}
                      type="button"
                      className={cx('iosapp-country-option', selected && 'is-selected')}
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectCountry(option.code)}
                    >
                      <img src={option.flagSrc} alt="" width={24} height={18} loading="lazy" />
                      <span className="iosapp-country-option-name">{option.name}</span>
                      <span className="iosapp-country-option-dial">+{option.dial}</span>
                      {selected ? <Check size={18} aria-hidden /> : <span aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DepartureDetailsSheet({
  departure,
  onClose,
  onViewItinerary,
  onSelect,
}: {
  departure: GroupTourDeparture;
  onClose: () => void;
  onViewItinerary: () => void;
  onSelect: () => void;
}) {
  const route = getRouteBySlug(departure.routeSlug);
  const unitPrice = (departure.adultPriceCents / 100).toFixed(0);
  const included = departure.includedItems;
  const excluded = departure.excludedItems;
  const notes = departure.importantNotes;
  const cancellation = departure.cancellationLines;

  return (
    <div className="iosapp-sheet-root" role="presentation">
      <button type="button" className="iosapp-sheet-backdrop" aria-label="Close departure details" onClick={onClose} />
      <div
        className="iosapp-sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="departure-details-title"
      >
        <header className="iosapp-sheet-header">
          <div>
            <span className="iosapp-kicker">Departure package</span>
            <h2 id="departure-details-title">{route?.title || 'Departure details'}</h2>
          </div>
          <button type="button" className="iosapp-sheet-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <div className="iosapp-sheet-body">
          <div className="iosapp-summary-lines">
            <span>
              Dates <b>{formatDepartureDateRange(departure)}</b>
            </span>
            <span>
              Departure city <b>{departure.departureCity}</b>
            </span>
            <span>
              Price <b>${unitPrice} {departure.currency} / adult</b>
            </span>
            <span>
              Spots <b>{departure.spotsLeft} of {departure.capacity} left</b>
            </span>
            <span>
              Guarantee <b>{departure.guaranteed ? 'Guaranteed departure' : 'Subject to minimum group size'}</b>
            </span>
          </div>

          {departure.note && (
            <section className="iosapp-detail-block">
              <h3>Confirmation rule</h3>
              <p>{departure.note}</p>
            </section>
          )}

          <section className="iosapp-detail-block">
            <h3>Included</h3>
            {included.length ? (
              <ul>{included.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : (
              <p>Inclusion details will be confirmed with your booking.</p>
            )}
          </section>

          <section className="iosapp-detail-block">
            <h3>Not included</h3>
            {excluded.length ? (
              <ul>{excluded.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : (
              <p>Exclusion details will be confirmed with your booking.</p>
            )}
          </section>

          <section className="iosapp-detail-block">
            <h3>Important notes</h3>
            {notes.length ? (
              <ul>{notes.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : (
              <p>No extra notes for this departure yet.</p>
            )}
          </section>

          <section className="iosapp-detail-block">
            <h3>Cancellation policy</h3>
            {cancellation.length ? (
              <ul>{cancellation.map((item) => <li key={item}>{item}</li>)}</ul>
            ) : (
              <p>Cancellation terms will be confirmed with your booking.</p>
            )}
          </section>
        </div>

        <footer className="iosapp-sheet-actions">
          <Button type="button" variant="ghost" className="iosapp-secondary-button" onClick={onViewItinerary}>
            View itinerary
          </Button>
          <Button type="button" variant="ghost" className="iosapp-primary-button" onClick={onSelect}>
            Select this departure
          </Button>
        </footer>
      </div>
    </div>
  );
}

function CustomTab({
  draft,
  status,
  fieldErrors,
  formError,
  message,
  turnstileResetSignal,
  preferenceFields,
  preferences,
  moreOpen,
  configLoading,
  configError,
  onFieldChange,
  onPhoneChange,
  onToggleChoice,
  onPreferenceChange,
  onMoreOpenChange,
  onTurnstileToken,
  onSubmit,
}: {
  draft: CustomTripDraft;
  status: CustomSubmitStatus;
  fieldErrors: FieldErrors;
  formError: string;
  message: string;
  turnstileResetSignal: number;
  preferenceFields: CustomTripFormField[];
  preferences: CustomPreferences;
  moreOpen: boolean;
  configLoading: boolean;
  configError: string;
  onFieldChange: (field: CustomTextField, value: string) => void;
  onPhoneChange: (countryCode: string, nationalNumber: string) => void;
  onToggleChoice: (field: CustomChoiceField, value: string) => void;
  onPreferenceChange: (fieldKey: string, value: unknown) => void;
  onMoreOpenChange: (open: boolean) => void;
  onTurnstileToken: (token: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isSubmitting = status === 'loading';
  const customDestinationOptions = useMemo(
    () => [...destinationMeta.slice(0, 10).map((destination) => destination.name), 'Other'],
    [],
  );
  const basicFields = useMemo(
    () => preferenceFieldsByGroup(preferenceFields, 'basic'),
    [preferenceFields],
  );
  const moreFields = useMemo(
    () => preferenceFieldsByGroup(preferenceFields, 'more'),
    [preferenceFields],
  );

  return (
    <motion.div variants={tabPanelVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={fadeUpItem}>
        <AppHeader title="Custom" subtitle="Private trip planning" />
      </motion.div>
      <motion.section className="iosapp-grouped-card iosapp-custom-intro" variants={fadeUpItem}>
        <span className="iosapp-kicker">Private custom trip</span>
        <h2>Tell us what you want to build</h2>
        <p>Share rough dates, places, pace, hotel style, and contact details. A China-based planner will reply with next steps.</p>
      </motion.section>

      <motion.form className="iosapp-form iosapp-custom-form" onSubmit={onSubmit} noValidate variants={fadeUpItem}>
        <input type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" aria-hidden="true" hidden />

        <section className="iosapp-form-section">
          <h2>Trip idea</h2>
          <div
            className={cx('iosapp-choice-block', fieldErrors.destinations && 'is-invalid')}
            data-field-error="destinations"
          >
            <span>Destinations *</span>
            <div className="iosapp-choice-grid">
              {customDestinationOptions.map((destination) => (
                <label key={destination} className={cx('iosapp-choice-chip', draft.destinations.includes(destination) && 'is-selected')}>
                  <input
                    type="checkbox"
                    checked={draft.destinations.includes(destination)}
                    onChange={() => onToggleChoice('destinations', destination)}
                  />
                  <b>{destination}</b>
                </label>
              ))}
            </div>
            <FieldHint id={fieldErrorId('destinations')} message={fieldErrors.destinations} />
          </div>
          <label className={cx('iosapp-input-row', fieldErrors.destinations && 'is-invalid')}>
            <span>Other place</span>
            <Input
              value={draft.otherDestination}
              onChange={(event) => onFieldChange('otherDestination', event.target.value)}
              placeholder="Optional"
              aria-invalid={Boolean(fieldErrors.destinations)}
            />
          </label>
          <div data-field-error="timing" className={cx(fieldErrors.timing && 'iosapp-timing-group is-invalid')}>
            <label className={cx('iosapp-input-row', fieldErrors.timing && 'is-invalid')}>
              <span>Travel date *</span>
              <Input
                value={draft.travelMonth}
                onChange={(event) => onFieldChange('travelMonth', event.target.value)}
                placeholder="Oct 2026 or flexible"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.timing)}
                aria-describedby={fieldErrors.timing ? fieldErrorId('timing') : undefined}
              />
            </label>
            <label className={cx('iosapp-select-row', fieldErrors.timing && 'is-invalid')}>
              <span>Travelers *</span>
              <select
                value={draft.travelers}
                onChange={(event) => onFieldChange('travelers', event.target.value)}
                aria-invalid={Boolean(fieldErrors.timing)}
              >
                <option value="">Select</option>
                {customTravelerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={cx('iosapp-select-row', fieldErrors.timing && 'is-invalid')}>
              <span>Trip length *</span>
              <select
                value={draft.tripLength}
                onChange={(event) => onFieldChange('tripLength', event.target.value)}
                aria-invalid={Boolean(fieldErrors.timing)}
              >
                <option value="">Select</option>
                {customTripLengthOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <FieldHint id={fieldErrorId('timing')} message={fieldErrors.timing} />
          </div>
        </section>

        <section className="iosapp-form-section">
          <h2>Preferences</h2>
          {configLoading && <p className="iosapp-pref-status">Loading preference options...</p>}
          {configError && <p className="iosapp-form-error" role="alert">{configError}</p>}
          {!configLoading && !configError && (
            <CustomTripPreferenceSections
              basicFields={basicFields}
              moreFields={moreFields}
              values={preferences}
              errors={fieldErrors}
              moreOpen={moreOpen}
              onMoreOpenChange={onMoreOpenChange}
              variant="mobile"
              onChange={onPreferenceChange}
            />
          )}
          <div className="iosapp-choice-block">
            <span>Interests</span>
            <div className="iosapp-choice-grid">
              {customInterestOptions.map((interest) => (
                <label key={interest} className={cx('iosapp-choice-chip', draft.interests.includes(interest) && 'is-selected')}>
                  <input
                    type="checkbox"
                    checked={draft.interests.includes(interest)}
                    onChange={() => onToggleChoice('interests', interest)}
                  />
                  <b>{interest}</b>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="iosapp-form-section">
          <h2>Contact</h2>
          <label className={cx('iosapp-input-row', fieldErrors.name && 'is-invalid')} data-field-error="name">
            <span>Name *</span>
            <Input
              value={draft.name}
              onChange={(event) => onFieldChange('name', event.target.value)}
              placeholder="Full name"
              autoComplete="name"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
            />
          </label>
          <FieldHint id={fieldErrorId('name')} message={fieldErrors.name} />
          <label className={cx('iosapp-input-row', fieldErrors.email && 'is-invalid')} data-field-error="email">
            <span>Email *</span>
            <Input
              value={draft.email}
              onChange={(event) => onFieldChange('email', event.target.value)}
              placeholder="you@example.com"
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? fieldErrorId('email') : undefined}
            />
          </label>
          <FieldHint id={fieldErrorId('email')} message={fieldErrors.email} />
          <PhoneCountryField
            countryCode={draft.phoneCountry}
            nationalNumber={draft.phoneNational}
            error={fieldErrors.phone}
            onCountryChange={(code) => onPhoneChange(code, draft.phoneNational)}
            onNationalChange={(value) => onPhoneChange(draft.phoneCountry, value)}
          />
          <div className="iosapp-choice-block">
            <span>Reply by</span>
            <div className="iosapp-choice-grid is-two">
              {customContactOptions.map((option) => (
                <label key={option} className={cx('iosapp-choice-chip', draft.contactPreferences.includes(option) && 'is-selected')}>
                  <input
                    type="checkbox"
                    checked={draft.contactPreferences.includes(option)}
                    onChange={() => onToggleChoice('contactPreferences', option)}
                  />
                  <b>{option}</b>
                </label>
              ))}
            </div>
          </div>
          <label className="iosapp-input-row iosapp-textarea-row">
            <span>Notes</span>
            <textarea
              value={draft.message}
              onChange={(event) => onFieldChange('message', event.target.value)}
              placeholder="Kids, seniors, food needs, guide language, must-see places, or anything you are unsure about"
            />
          </label>
          <div
            className={cx('iosapp-turnstile-row', fieldErrors.turnstile && 'is-invalid')}
            data-field-error="turnstile"
          >
            <TurnstileWidget onTokenChange={onTurnstileToken} resetSignal={turnstileResetSignal} />
            <FieldHint id={fieldErrorId('turnstile')} message={fieldErrors.turnstile} />
          </div>
        </section>

        {formError && (
          <div className="iosapp-form-error" role="alert">
            <p>{formError}</p>
          </div>
        )}
        {message && <p className="iosapp-form-message">{message}</p>}

        <Button
          type="submit"
          variant="ghost"
          className="iosapp-primary-button"
          disabled={isSubmitting || configLoading || Boolean(configError)}
        >
          {isSubmitting ? 'Sending request...' : 'Send private trip request'}
        </Button>
      </motion.form>
    </motion.div>
  );
}

function ProviderMark({ provider, appearance }: { provider: AuthProvider; appearance: 'light' | 'dark' }) {
  if (provider === 'google') {
    return (
      <img className="iosapp-provider-mark" src={googleIconSrc} alt="" aria-hidden="true" loading="lazy" />
    );
  }

  if (provider === 'apple') {
    return (
      <img
        className="iosapp-provider-mark"
        src={appearance === 'dark' ? appleIconLightSrc : appleIconSrc}
        alt=""
        aria-hidden="true"
        loading="lazy"
      />
    );
  }

  return (
    <span className="iosapp-provider-mark" aria-hidden="true">
      <Mail size={19} />
    </span>
  );
}

function SignInOptions({
  onSignIn,
  appearance = 'light',
  disabled = false,
}: {
  onSignIn: (provider: AuthProvider) => void;
  appearance?: 'light' | 'dark';
  disabled?: boolean;
}) {
  const providers: Array<{ label: string; provider: AuthProvider }> = [
    { label: 'Continue with Google', provider: 'google' },
    { label: 'Continue with email', provider: 'email' },
    { label: 'Continue with Apple', provider: 'apple' },
  ];

  return (
    <div className={cx('iosapp-card-list', appearance === 'dark' && 'iosapp-auth-options')}>
      {providers.map(({ label, provider }) => (
        <button
          key={label}
          type="button"
          className={cx('iosapp-login-row', appearance === 'dark' && 'is-dark')}
          disabled={disabled}
          onClick={() => onSignIn(provider)}
        >
          <ProviderMark provider={provider} appearance={appearance} />
          <span>{label}</span>
          {appearance === 'light' && <ChevronRight size={18} />}
        </button>
      ))}
    </div>
  );
}

function formatOrderStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function MeTab({
  isSignedIn,
  authUser,
  draft,
  onSignIn,
  onOpenMyOrders,
}: {
  isSignedIn: boolean;
  authUser: AuthUser | null;
  draft: GroupRequestDraft;
  onSignIn: (provider: AuthProvider) => void;
  onOpenMyOrders: () => void;
}) {
  return (
    <motion.div variants={tabPanelVariants} initial="initial" animate="animate" exit="exit">
      <motion.div variants={fadeUpItem}>
        <AppHeader title="Me" subtitle="Requests and deposits" />
      </motion.div>
      {!isSignedIn ? (
        <motion.section className="iosapp-account-card" variants={fadeUpItem}>
          <div>
            <span className="iosapp-account-avatar">
              <UserRound size={25} />
            </span>
            <h2>Sign in to manage your trip</h2>
            <p>View reserve requests, deposits, and planner messages from one account.</p>
          </div>
          <SignInOptions onSignIn={onSignIn} />
          <Link to="/" className="iosapp-settings-row iosapp-settings-row-link">
            <span className="iosapp-settings-icon">
              <Home size={19} />
            </span>
            <span>
              <strong>Back to website</strong>
              <small>Return to Syncing Travel homepage</small>
            </span>
            <ChevronRight size={18} />
          </Link>
        </motion.section>
      ) : (
        <motion.div className="iosapp-settings-list" variants={staggerListVariants}>
          <motion.button
            type="button"
            className="iosapp-settings-row"
            onClick={onOpenMyOrders}
            variants={listRowVariants}
            whileTap={tapScale}
          >
            <span className="iosapp-settings-icon">
              <BadgeCheck size={19} />
            </span>
            <span>
              <strong>My Orders</strong>
              <small>View your bookings and deposits</small>
            </span>
            <ChevronRight size={18} />
          </motion.button>
          <motion.button type="button" className="iosapp-settings-row" variants={listRowVariants} whileTap={tapScale}>
            <span className="iosapp-settings-icon">
              <UserRound size={19} />
            </span>
            <span>
              <strong>Contact info</strong>
              <small>{authUser?.email || draft.email || 'Add email before checkout'}</small>
            </span>
            <ChevronRight size={18} />
          </motion.button>
          <Link to="/" className="iosapp-settings-row iosapp-settings-row-link">
            <span className="iosapp-settings-icon">
              <Home size={19} />
            </span>
            <span>
              <strong>Back to website</strong>
              <small>Return to Syncing Travel homepage</small>
            </span>
            <ChevronRight size={18} />
          </Link>
          <motion.button
            type="button"
            className="iosapp-settings-row"
            onClick={() => {
              clearStoredAuthSession();
              window.location.reload();
            }}
            variants={listRowVariants}
            whileTap={tapScale}
          >
            <span className="iosapp-settings-icon">
              <LogOut size={19} />
            </span>
            <span>
              <strong>Sign out</strong>
              <small>{authUser?.email}</small>
            </span>
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}

function MyOrdersView({
  email,
  status,
  error,
  orders,
  onBack,
  onExplore,
  onOpenOrder,
  onRetry,
  onLinkedOrder,
}: {
  email: string | null | undefined;
  status: MyOrdersStatus;
  error: string;
  orders: SafeOrderSummary[];
  onBack: () => void;
  onExplore: () => void;
  onOpenOrder: (order: SafeOrderSummary) => void;
  onRetry: () => void;
  onLinkedOrder: () => void;
}) {
  return (
    <div className="china-trips-mobile-page iosapp-page">
      <BackBar title="My Orders" onBack={onBack} />
      <main className="iosapp-screen">
        {email && <p className="iosapp-orders-email">{email}</p>}

        <LinkOrderToAccount
          allowPaste
          autoClaim={false}
          variant="mobile"
          onLinked={onLinkedOrder}
        />

        {status === 'loading' && (
          <p className="iosapp-orders-status">Loading your orders...</p>
        )}

        {status === 'error' && (
          <section className="iosapp-orders-empty">
            <p>{error || 'We could not load your orders.'}</p>
            <button type="button" className="iosapp-secondary-button" onClick={onRetry}>
              Try again
            </button>
          </section>
        )}

        {status === 'ready' && orders.length === 0 && (
          <section className="iosapp-orders-empty">
            <p>You have not placed any orders yet.</p>
            <button type="button" className="iosapp-primary-button" onClick={onExplore}>
              Explore trips
            </button>
          </section>
        )}

        {status === 'ready' && orders.length > 0 && (
          <div className="iosapp-orders-list" role="list">
            {orders.map((order) => {
              const dateLabel = formatOrderDateRange(
                order.route_snapshot.start_date,
                order.route_snapshot.end_date,
              );
              const total = `$${(order.total_price_cents / 100).toFixed(2)} ${order.currency || 'USD'}`;
              return (
                <button
                  key={order.order_number}
                  type="button"
                  className="iosapp-order-row"
                  role="listitem"
                  onClick={() => onOpenOrder(order)}
                >
                  <span className="iosapp-order-row-main">
                    <strong>{order.route_snapshot.route_title}</strong>
                    <small>
                      {dateLabel} · {order.route_snapshot.departure_city}
                    </small>
                    <small className="iosapp-order-meta">
                      Order {order.order_number} · {total}
                    </small>
                  </span>
                  <span className="iosapp-order-status">{formatOrderStatusLabel(order.status)}</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="iosapp-nav-bar">
      <button type="button" onClick={onBack} aria-label="Back">
        <ChevronLeft size={24} />
      </button>
      <strong>{title}</strong>
      <span />
    </header>
  );
}

function GroupRequestView({
  draft,
  selectedDeparture,
  departures,
  onBack,
  onDraftChange,
  onTravelerNameChange,
  onPhoneChange,
  onSelectDeparture,
  onViewItinerary,
  onContinue,
}: {
  draft: GroupRequestDraft;
  selectedDeparture?: GroupTourDeparture;
  departures: GroupTourDeparture[];
  onBack: () => void;
  onDraftChange: (field: keyof GroupRequestDraft, value: string | number) => void;
  onTravelerNameChange: (index: number, name: string) => void;
  onPhoneChange: (countryCode: string, nationalNumber: string) => void;
  onSelectDeparture: (departure: GroupTourDeparture) => void;
  onViewItinerary: (routeSlug: string) => void;
  onContinue: () => void;
}) {
  const [destinationFilter, setDestinationFilter] = useState<string>(draft.destinationSlug || 'all');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [detailsDepartureId, setDetailsDepartureId] = useState('');
  const routeScoped = Boolean(draft.routeSlug);
  const scopedRoute = routeScoped ? getRouteBySlug(draft.routeSlug) : undefined;
  const destinationFilters = getDepartureDestinationFilters(departures);
  const filteredDepartures = departures.filter((departure) => {
    if (routeScoped && departure.routeSlug !== draft.routeSlug) return false;
    const route = getRouteBySlug(departure.routeSlug);
    const matchesDestination =
      destinationFilter === 'all' || Boolean(route?.destinationSlugs.includes(destinationFilter));

    return matchesDestination;
  });
  const departureGroups = groupDeparturesByMonth(filteredDepartures);
  const detailsDeparture = departures.find((departure) => departure.id === detailsDepartureId);

  const handleContinue = (formElement: HTMLFormElement) => {
    const nextErrors: FieldErrors = {};
    const email = draft.email.trim();
    const travelerError = validateTravelerNames(draft.travelers, draft.adultQuantity);
    const phoneError = validateOptionalPhoneInput(draft.phoneCountry, draft.phoneNational);

    if (!selectedDeparture) nextErrors.departure = 'Choose an available departure date.';
    if (travelerError) {
      nextErrors[`traveler-${travelerError.index}`] = travelerError.message;
    }
    if (!email) nextErrors.email = 'Enter your email address.';
    else if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (phoneError) nextErrors.phone = phoneError;

    const fieldOrder = [
      'departure',
      ...draft.travelers.map((_, index) => `traveler-${index}`),
      'email',
      'phone',
    ];

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => {
        focusFirstFieldError(fieldOrder, nextErrors, formElement);
      });
      return;
    }

    onContinue();
  };

  return (
    <div className="china-trips-mobile-page iosapp-page">
      <BackBar title="Group tour" onBack={onBack} />
      <main className="iosapp-screen">
        <header className="iosapp-flow-intro">
          <span className="iosapp-kicker">Group tour</span>
          <h1>{scopedRoute ? scopedRoute.title : 'Group tour departures'}</h1>
          <p>
            {scopedRoute
              ? 'Fixed-price, guaranteed departures for this route. Full payment confirms your booking.'
              : 'Fixed-price, guaranteed departures. Full payment confirms your booking.'}
          </p>
        </header>

        <form
          className="iosapp-form iosapp-departure-flow"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleContinue(event.currentTarget);
          }}
        >
          <section className="iosapp-form-section iosapp-departure-section">
            <h2>{scopedRoute ? 'Choose a date' : 'Choose a route date'}</h2>
            {!routeScoped && (
              <FilterRail
                options={destinationFilters}
                value={destinationFilter}
                onChange={(value) => setDestinationFilter(value)}
              />
            )}
            <div
              className={cx('iosapp-departure-list', fieldErrors.departure && 'is-invalid')}
              data-field-error="departure"
            >
              {filteredDepartures.length === 0 && (
                <div className="iosapp-departure-empty">
                  <b>
                    {scopedRoute
                      ? 'No available departures for this route yet.'
                      : 'No available departures for these filters yet.'}
                  </b>
                  <small>
                    {scopedRoute
                      ? 'Ask us to plan a private trip based on this route instead.'
                      : 'Try all dates or choose another place.'}
                  </small>
                </div>
              )}
              {departureGroups.map((group) => (
                <div key={group.key} className="iosapp-departure-month-group">
                  <span className="iosapp-departure-month">{group.label}</span>
                  {group.departures.map((departure) => {
                    const route = getRouteBySlug(departure.routeSlug);
                    if (!route) return null;

                    const isSelected = draft.departureId === departure.id;
                    const destinationNames = getRouteDestinationNames(route).join(' · ');

                    return (
                      <div
                        key={departure.id}
                        className={cx('iosapp-departure-card', isSelected && 'is-selected')}
                      >
                        <button
                          type="button"
                          className="iosapp-departure-select"
                          onClick={() => {
                            setFieldErrors((current) => {
                              const next = { ...current };
                              delete next.departure;
                              return next;
                            });
                            onSelectDeparture(departure);
                          }}
                        >
                          <img src={route.image} alt={route.title} />
                          <span className="iosapp-departure-date">
                            <b>{formatDepartureDay(departure.startDate)}</b>
                            <small>{formatDepartureMonth(departure.startDate)}</small>
                          </span>
                          <span className="iosapp-departure-copy">
                            <span className="iosapp-departure-status">
                              <strong>{departure.status}</strong>
                              <small>
                                {departure.spotsLeft} of {departure.capacity} spots left
                              </small>
                            </span>
                            <b>{route.title}</b>
                            <small>
                              {formatDepartureDateRange(departure)} · {departure.departureCity} departure
                            </small>
                            <small>{destinationNames}</small>
                            <em>{departure.note}</em>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="iosapp-departure-details-btn"
                          onClick={() => setDetailsDepartureId(departure.id)}
                        >
                          View details
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
              <FieldHint id={fieldErrorId('departure')} message={fieldErrors.departure} />
            </div>
          </section>

          <section className="iosapp-form-section">
            <h2>Booking details</h2>
            <div className={cx('iosapp-selected-departure', !selectedDeparture && 'is-empty')}>
              {selectedDeparture ? (
                <>
                  <span>
                    <b>{formatDepartureDateRange(selectedDeparture)}</b>
                    <small>{getRouteBySlug(selectedDeparture.routeSlug)?.title}</small>
                  </span>
                  <strong>{selectedDeparture.status}</strong>
                </>
              ) : (
                <span>
                  <b>Select an available departure</b>
                  <small>Dates and route are required before checkout.</small>
                </span>
              )}
            </div>
            <label className="iosapp-input-row">
              <span>Adults</span>
              <select
                value={draft.adultQuantity}
                onChange={(event) => onDraftChange('adultQuantity', Number(event.target.value))}
                disabled={!selectedDeparture}
              >
                {Array.from(
                  { length: Math.min(8, Math.max(1, selectedDeparture?.spotsLeft ?? 8)) },
                  (_, i) => i + 1,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n} adult{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedDeparture && <DepartureJoinedRoster departure={selectedDeparture} />}

            <div className="iosapp-traveler-block">
              {draft.travelers.map((traveler, index) => {
                const errorKey = `traveler-${index}`;
                const error = fieldErrors[errorKey];
                return (
                  <div key={errorKey}>
                    <label
                      className={cx('iosapp-input-row', error && 'is-invalid')}
                      data-field-error={errorKey}
                    >
                      <span>
                        Traveler {index + 1}
                        {index === 0 ? ' (lead) *' : ' *'}
                      </span>
                      <Input
                        value={traveler.name}
                        onChange={(event) => {
                          setFieldErrors((current) => {
                            const next = { ...current };
                            delete next[errorKey];
                            return next;
                          });
                          onTravelerNameChange(index, event.target.value);
                        }}
                        placeholder={index === 0 ? 'Lead traveler full name' : `Adult ${index + 1} full name`}
                        autoComplete={index === 0 ? 'name' : 'off'}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? fieldErrorId(errorKey) : undefined}
                      />
                    </label>
                    <FieldHint id={fieldErrorId(errorKey)} message={error} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className={cx('iosapp-form-section', !selectedDeparture && 'is-muted')}>
            <h2>Contact</h2>
            <label className={cx('iosapp-input-row', fieldErrors.email && 'is-invalid')} data-field-error="email">
              <span>Email *</span>
              <Input
                value={draft.email}
                onChange={(event) => {
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.email;
                    return next;
                  });
                  onDraftChange('email', event.target.value);
                }}
                placeholder="you@example.com"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? fieldErrorId('email') : undefined}
              />
            </label>
            <FieldHint id={fieldErrorId('email')} message={fieldErrors.email} />
            <PhoneCountryField
              countryCode={draft.phoneCountry}
              nationalNumber={draft.phoneNational}
              error={fieldErrors.phone}
              onCountryChange={(code) => {
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.phone;
                  return next;
                });
                onPhoneChange(code, draft.phoneNational);
              }}
              onNationalChange={(value) => {
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.phone;
                  return next;
                });
                onPhoneChange(draft.phoneCountry, value);
              }}
            />
            <label className="iosapp-input-row iosapp-textarea-row">
              <span>Notes</span>
              <textarea
                value={draft.notes}
                onChange={(event) => onDraftChange('notes', event.target.value)}
                placeholder="Hotel level, pace, food, accessibility, or guide language"
              />
            </label>
          </section>

          <Button type="submit" variant="ghost" className="iosapp-primary-button">
            Review and pay
          </Button>
        </form>
      </main>

      {detailsDeparture && (
        <DepartureDetailsSheet
          departure={detailsDeparture}
          onClose={() => setDetailsDepartureId('')}
          onViewItinerary={() => {
            setDetailsDepartureId('');
            onViewItinerary(detailsDeparture.routeSlug);
          }}
          onSelect={() => {
            setFieldErrors((current) => {
              const next = { ...current };
              delete next.departure;
              return next;
            });
            onSelectDeparture(detailsDeparture);
            setDetailsDepartureId('');
          }}
        />
      )}
    </div>
  );
}

function SignInView({
  email,
  otpCode,
  authStep,
  authStatus,
  authMessage,
  authError,
  resendIn,
  onBack,
  onEmailChange,
  onOtpChange,
  onProviderSignIn,
  onEmailSignIn,
  onVerifyOtp,
  onResendOtp,
  onEditEmail,
}: {
  email: string;
  otpCode: string;
  authStep: 'email' | 'code';
  authStatus: AuthStatus;
  authMessage: string;
  authError: string;
  resendIn: number;
  onBack: () => void;
  onEmailChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onProviderSignIn: (provider: AuthProvider) => void;
  onEmailSignIn: () => void;
  onVerifyOtp: () => void;
  onResendOtp: () => void;
  onEditEmail: () => void;
}) {
  const isSigningIn = authStatus === 'loading';

  return (
    <div className="china-trips-mobile-page iosapp-page iosapp-auth-page">
      <header className="iosapp-auth-nav">
        <button type="button" onClick={onBack} aria-label="Back">
          <ChevronLeft size={25} />
        </button>
      </header>
      <main className="iosapp-auth-screen">
        <section className="iosapp-auth-copy">
          <h1>Sign in or create an account</h1>
          <p>
            {authStep === 'code'
              ? 'Enter the 6-digit code from your email to continue.'
              : 'Verify your email before deposit payment, then return anytime to manage requests and receipts.'}
          </p>
        </section>
        {authStep === 'email' ? (
          <>
            <SignInOptions onSignIn={onProviderSignIn} appearance="dark" disabled={isSigningIn} />
            <div className="iosapp-auth-divider">
              <span />
              <b>or</b>
              <span />
            </div>
            <label
              className={cx('iosapp-auth-email', authError && !isValidEmail(email.trim()) && 'is-invalid')}
              data-field-error="email"
            >
              <span>Email address</span>
              <Input
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="you@example.com"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-invalid={Boolean(authError && !isValidEmail(email.trim()))}
                aria-describedby={authError ? fieldErrorId('email') : undefined}
              />
            </label>
            {authError && (
              <p id={fieldErrorId('email')} className="iosapp-auth-error" role="alert">
                {authError}
              </p>
            )}
            {authMessage && <p className="iosapp-auth-message">{authMessage}</p>}
            <Button
              type="button"
              variant="ghost"
              className="iosapp-auth-submit"
              disabled={isSigningIn}
              onClick={onEmailSignIn}
            >
              {isSigningIn ? 'Signing in...' : 'Continue with email'}
            </Button>
          </>
        ) : (
          <>
            <label className="iosapp-auth-email" data-field-error="otp">
              <span>Code sent to {email.trim()}</span>
              <Input
                value={otpCode}
                onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="6-digit code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-invalid={Boolean(authError)}
                aria-describedby={authError ? fieldErrorId('otp') : undefined}
              />
            </label>
            {authError && (
              <p id={fieldErrorId('otp')} className="iosapp-auth-error" role="alert">
                {authError}
              </p>
            )}
            {authMessage && <p className="iosapp-auth-message">{authMessage}</p>}
            <Button
              type="button"
              variant="ghost"
              className="iosapp-auth-submit"
              disabled={isSigningIn || otpCode.trim().length < 6}
              onClick={onVerifyOtp}
            >
              {isSigningIn ? 'Verifying...' : 'Verify code'}
            </Button>
            <div className="iosapp-auth-divider">
              <span />
              <b>or</b>
              <span />
            </div>
            <Button type="button" variant="ghost" className="iosapp-auth-submit" onClick={onEditEmail}>
              Use a different email
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="iosapp-auth-submit"
              disabled={isSigningIn || resendIn > 0}
              onClick={onResendOtp}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

function ReserveReviewView({
  selectedDestinationName,
  selectedRouteTitle,
  selectedDeparture,
  draft,
  checkoutStatus,
  checkoutError,
  onBack,
  onSubmitCheckout,
}: {
  selectedDestinationName: string;
  selectedRouteTitle: string;
  selectedDeparture?: GroupTourDeparture;
  draft: GroupRequestDraft;
  checkoutStatus: CheckoutStatus;
  checkoutError: string;
  onBack: () => void;
  onSubmitCheckout: () => void;
}) {
  const isSubmittingCheckout = checkoutStatus === 'loading';
  const currency = selectedDeparture?.currency || 'USD';
  const unitPriceDollars = selectedDeparture
    ? (selectedDeparture.adultPriceCents / 100).toFixed(2)
    : '0.00';
  const totalPriceDollars = selectedDeparture
    ? ((selectedDeparture.adultPriceCents * draft.adultQuantity) / 100).toFixed(2)
    : '0.00';
  const cancellationSummary =
    selectedDeparture?.cancellationLines[0] ||
    'Per the cancellation policy for this departure.';
  const dateLabel = selectedDeparture
    ? formatDepartureDateRange(selectedDeparture)
    : draft.dateRange || 'Flexible dates';
  const spotsLabel = selectedDeparture
    ? `${selectedDeparture.spotsLeft} of ${selectedDeparture.capacity} left`
    : null;

  return (
    <div className="china-trips-mobile-page iosapp-page">
      <BackBar title="Book" onBack={onBack} />
      <main className="iosapp-screen">
        <section className="iosapp-form-section iosapp-checkout-review">
          <header className="iosapp-checkout-hero">
            <span className="iosapp-kicker">{selectedDestinationName || 'Group tour'}</span>
            <h1>{selectedRouteTitle || 'Confirm booking'}</h1>
            <p>{dateLabel}</p>
            {(selectedDeparture?.status || spotsLabel) && (
              <div className="iosapp-checkout-meta">
                {selectedDeparture?.status && <strong>{selectedDeparture.status}</strong>}
                {spotsLabel && <span>{spotsLabel}</span>}
              </div>
            )}
          </header>

          <div className="iosapp-review-group" aria-label="Travelers">
            <h2>Travelers</h2>
            <div className="iosapp-review-row">
              <span>Adults</span>
              <b>{draft.adultQuantity}</b>
            </div>
            {draft.travelers.map((traveler, index) => (
              <div className="iosapp-review-row" key={`review-name-${index}`}>
                <span>
                  Traveler {index + 1}
                  {index === 0 ? ' (lead)' : ''}
                </span>
                <b className="iosapp-review-value">{traveler.name || 'Missing name'}</b>
              </div>
            ))}
            <div className="iosapp-review-row">
              <span>Email</span>
              <b className="iosapp-review-value">{draft.email || 'Missing email'}</b>
            </div>
            {draft.phone && (
              <div className="iosapp-review-row">
                <span>Phone</span>
                <b className="iosapp-review-value">{draft.phone}</b>
              </div>
            )}
          </div>

          <div className="iosapp-review-group" aria-label="Payment summary">
            <h2>Payment</h2>
            <div className="iosapp-review-row">
              <span>Price per adult</span>
              <b className="iosapp-review-money">
                ${unitPriceDollars} {currency}
              </b>
            </div>
            <div className="iosapp-review-row iosapp-review-total">
              <span>Total due today</span>
              <b className="iosapp-review-money">
                ${totalPriceDollars} {currency}
              </b>
            </div>
            <p className="iosapp-checkout-note">{cancellationSummary}</p>
          </div>

          <div className="iosapp-stripe-trust">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>
              Secure Stripe Checkout - card details stay with Stripe. Syncing Travel never stores them.
            </p>
          </div>
        </section>

        {checkoutError && (
          <p className="iosapp-checkout-error" role="alert">
            {checkoutError}
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          className="iosapp-primary-button"
          disabled={isSubmittingCheckout}
          onClick={onSubmitCheckout}
        >
          {isSubmittingCheckout ? 'Opening Stripe Checkout...' : 'Pay full amount'}
        </Button>
      </main>
    </div>
  );
}

function BookingConfirmedView({
  order,
  status,
  error,
  onBack,
  mode = 'success',
  claimProof = null,
  onLinkedOrder,
}: {
  order: SafeOrderSummary | null;
  status: BookingConfirmedStatus;
  error: string;
  onBack: () => void;
  mode?: 'success' | 'detail';
  claimProof?: { orderNumber: string; token?: string; sessionId?: string } | null;
  onLinkedOrder?: () => void;
}) {
  const navTitle = mode === 'detail' ? 'Order details' : 'Booking confirmed';
  const backLabel = mode === 'detail' ? 'Back to My Orders' : 'Back to China Trips';

  if (status === 'loading') {
    return (
      <div className="china-trips-mobile-page iosapp-page">
        <BackBar title={navTitle} onBack={onBack} />
        <main className="iosapp-screen flex items-center justify-center p-8">
          <p className="text-muted-foreground">
            {mode === 'detail' ? 'Loading your order...' : 'Confirming your booking...'}
          </p>
        </main>
      </div>
    );
  }

  if (status === 'error' || !order) {
    return (
      <div className="china-trips-mobile-page iosapp-page">
        <BackBar title={navTitle} onBack={onBack} />
        <main className="iosapp-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-destructive">{error || 'We could not load your booking.'}</p>
          <button type="button" className="iosapp-secondary-button" onClick={onBack}>
            {backLabel}
          </button>
        </main>
      </div>
    );
  }

  const isConfirmed = order.status === 'confirmed';
  const currency = order.currency || 'USD';
  const totalPriceDollars = (order.total_price_cents / 100).toFixed(2);
  const dateLabel = formatOrderDateRange(order.route_snapshot.start_date, order.route_snapshot.end_date);
  const statusLabel = formatOrderStatusLabel(order.status);

  return (
    <div className="china-trips-mobile-page iosapp-page">
      <BackBar title={navTitle} onBack={onBack} />
      <main className="iosapp-screen">
        <section className="iosapp-form-section iosapp-checkout-review iosapp-booking-confirmed">
          <header className="iosapp-checkout-hero">
            <span className={cx('iosapp-success-badge', !isConfirmed && 'is-pending')}>
              <BadgeCheck size={18} aria-hidden="true" />
              {mode === 'detail' ? statusLabel : isConfirmed ? 'Payment received' : 'Payment processing'}
            </span>
            <h1>
              {mode === 'detail'
                ? order.route_snapshot.route_title
                : isConfirmed
                  ? 'Booking confirmed'
                  : 'Almost there'}
            </h1>
            <p>Order {order.order_number}</p>
          </header>

          {mode === 'success' && !isConfirmed && (
            <p className="iosapp-checkout-note iosapp-booking-waiting">
              We&apos;re waiting for payment confirmation. This usually takes a few moments - this page
              updates automatically.
            </p>
          )}

          <div className="iosapp-review-group" aria-label="Booking summary">
            {mode === 'success' && <h2>{order.route_snapshot.route_title}</h2>}
            <div className="iosapp-review-row">
              <span>Dates</span>
              <b className="iosapp-review-value">{dateLabel}</b>
            </div>
            <div className="iosapp-review-row">
              <span>Departure city</span>
              <b className="iosapp-review-value">{order.route_snapshot.departure_city}</b>
            </div>
            <div className="iosapp-review-row">
              <span>Adults</span>
              <b>{order.adult_quantity}</b>
            </div>
            <div className="iosapp-review-row iosapp-review-total">
              <span>{isConfirmed || mode === 'detail' ? 'Total paid' : 'Total'}</span>
              <b className="iosapp-review-money">
                ${totalPriceDollars} {currency}
              </b>
            </div>
          </div>
        </section>

        <div className="iosapp-booking-actions">
          {mode === 'success' && (
            <p className="iosapp-booking-cta-note">
              Traveler details are coming soon. For now, use the confirmation email to view your order.
            </p>
          )}
          <button type="button" className="iosapp-secondary-button" onClick={onBack}>
            {backLabel}
          </button>
        </div>

        {mode === 'success' && claimProof && (
          <LinkOrderToAccount
            proof={claimProof}
            variant="mobile"
            onLinked={onLinkedOrder}
          />
        )}

        {mode === 'success' && (
          <p className="iosapp-checkout-note">
            {formatConfirmationEmailNote(order.lead_email, order.confirmation_email_status)}
          </p>
        )}
      </main>
    </div>
  );
}

const tabItems: Array<{ key: MobileTab; label: string; icon: IconType }> = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'destinations', label: 'Places', icon: MapPin },
  { key: 'routes', label: 'Routes', icon: Map },
  { key: 'custom', label: 'Custom', icon: Compass },
  { key: 'me', label: 'Me', icon: UserRound },
];

function TabBar({ activeTab, onSelect }: { activeTab: MobileTab; onSelect: (tab: MobileTab) => void }) {
  return (
    <nav className="iosapp-tabbar" aria-label="Mobile app tabs">
      {tabItems.map(({ key, label, icon: Icon }) => (
        <motion.button
          key={key}
          type="button"
          className={cx('iosapp-tab-button', activeTab === key && 'is-active')}
          onClick={() => onSelect(key)}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 520, damping: 28 }}
        >
          <Icon size={21} />
          <span>{label}</span>
          <i aria-hidden="true" />
        </motion.button>
      ))}
    </nav>
  );
}

function WhatsAppShortcut() {
  return (
    <a
      href={brand.whatsappHref}
      target="_blank"
      rel="noreferrer"
      className="iosapp-whatsapp-fab"
      aria-label="Chat with Syncing Travel on WhatsApp"
    >
      <MessageCircle size={20} />
    </a>
  );
}

function TabContent({
  activeTab,
  query,
  draft,
  isSignedIn,
  authUser,
  customDraft,
  customStatus,
  customFieldErrors,
  customFormError,
  customMessage,
  customTurnstileResetSignal,
  onQueryChange,
  onSearch,
  onOpenCustom,
  onOpenGroup,
  onOpenFeaturedGroup,
  featuredDepartures,
  featuredLoading,
  onOpenPlace,
  onOpenRoute,
  onSelectTab,
  onSignIn,
  onOpenMyOrders,
  onCustomFieldChange,
  onCustomPhoneChange,
  onCustomToggleChoice,
  onCustomTurnstileToken,
  onCustomSubmit,
  preferenceFields,
  preferences,
  moreOpen,
  preferenceConfigLoading,
  preferenceConfigError,
  onPreferenceChange,
  onMoreOpenChange,
}: {
  activeTab: MobileTab;
  query: string;
  draft: GroupRequestDraft;
  isSignedIn: boolean;
  authUser: AuthUser | null;
  customDraft: CustomTripDraft;
  customStatus: CustomSubmitStatus;
  customFieldErrors: FieldErrors;
  customFormError: string;
  customMessage: string;
  customTurnstileResetSignal: number;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onOpenCustom: () => void;
  onOpenGroup: () => void;
  onOpenFeaturedGroup: (departureId: string) => void;
  featuredDepartures: GroupTourDeparture[];
  featuredLoading: boolean;
  onOpenPlace: (slug: string) => void;
  onOpenRoute: (slug: string) => void;
  onSelectTab: (tab: MobileTab) => void;
  onSignIn: (provider: AuthProvider) => void;
  onOpenMyOrders: () => void;
  onCustomFieldChange: (field: CustomTextField, value: string) => void;
  onCustomPhoneChange: (countryCode: string, nationalNumber: string) => void;
  onCustomToggleChoice: (field: CustomChoiceField, value: string) => void;
  onCustomTurnstileToken: (token: string) => void;
  onCustomSubmit: (event: FormEvent<HTMLFormElement>) => void;
  preferenceFields: CustomTripFormField[];
  preferences: CustomPreferences;
  moreOpen: boolean;
  preferenceConfigLoading: boolean;
  preferenceConfigError: string;
  onPreferenceChange: (fieldKey: string, value: unknown) => void;
  onMoreOpenChange: (open: boolean) => void;
}) {
  if (activeTab === 'destinations') return <DestinationsTab onOpenPlace={onOpenPlace} />;
  if (activeTab === 'routes') return <RoutesTab onOpenRoute={onOpenRoute} />;
  if (activeTab === 'custom') {
    return (
      <CustomTab
        draft={customDraft}
        status={customStatus}
        fieldErrors={customFieldErrors}
        formError={customFormError}
        message={customMessage}
        turnstileResetSignal={customTurnstileResetSignal}
        preferenceFields={preferenceFields}
        preferences={preferences}
        moreOpen={moreOpen}
        configLoading={preferenceConfigLoading}
        configError={preferenceConfigError}
        onFieldChange={onCustomFieldChange}
        onPhoneChange={onCustomPhoneChange}
        onToggleChoice={onCustomToggleChoice}
        onPreferenceChange={onPreferenceChange}
        onMoreOpenChange={onMoreOpenChange}
        onTurnstileToken={onCustomTurnstileToken}
        onSubmit={onCustomSubmit}
      />
    );
  }
  if (activeTab === 'me') {
    return (
      <MeTab
        isSignedIn={isSignedIn}
        authUser={authUser}
        draft={draft}
        onSignIn={onSignIn}
        onOpenMyOrders={onOpenMyOrders}
      />
    );
  }

  return (
    <HomeTab
      query={query}
      onQueryChange={onQueryChange}
      onSearch={onSearch}
      onOpenCustom={onOpenCustom}
      onOpenGroup={onOpenGroup}
      onOpenFeaturedGroup={onOpenFeaturedGroup}
      featuredDepartures={featuredDepartures}
      featuredLoading={featuredLoading}
      onOpenPlace={onOpenPlace}
      onOpenRoute={onOpenRoute}
      onSelectTab={onSelectTab}
    />
  );
}

export default function ChinaTripsMobile() {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [activeView, setActiveView] = useState<MobileView>('tabs');
  const [routeDetailReturnView, setRouteDetailReturnView] = useState<MobileView>('tabs');
  const [placeDetailReturnView, setPlaceDetailReturnView] = useState<MobileView>('tabs');
  const [query, setQuery] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => readStoredAuthSession()?.user ?? null);
  const [authIntent, setAuthIntent] = useState<AuthIntent>('checkout');
  const [draft, setDraft] = useState<GroupRequestDraft>(initialDraft);
  const [customDraft, setCustomDraft] = useState<CustomTripDraft>(initialCustomDraft);
  const [customStatus, setCustomStatus] = useState<CustomSubmitStatus>('idle');
  const [customFieldErrors, setCustomFieldErrors] = useState<FieldErrors>({});
  const [customFormError, setCustomFormError] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customTurnstileToken, setCustomTurnstileToken] = useState('');
  const [customTurnstileResetSignal, setCustomTurnstileResetSignal] = useState(0);
  const [routePrivateDraft, setRoutePrivateDraft] = useState<RoutePrivateDraft>(initialRoutePrivateDraft);
  const [routePrivateStatus, setRoutePrivateStatus] = useState<CustomSubmitStatus>('idle');
  const [routePrivateFieldErrors, setRoutePrivateFieldErrors] = useState<FieldErrors>({});
  const [routePrivateFormError, setRoutePrivateFormError] = useState('');
  const [routePrivateMessage, setRoutePrivateMessage] = useState('');
  const [routePrivateHint, setRoutePrivateHint] = useState('');
  const [routePrivateTurnstileToken, setRoutePrivateTurnstileToken] = useState('');
  const [routePrivateTurnstileResetSignal, setRoutePrivateTurnstileResetSignal] = useState(0);
  const [routePrivatePreferences, setRoutePrivatePreferences] = useState<CustomPreferences>({});
  const [preferenceFields, setPreferenceFields] = useState<CustomTripFormField[]>([]);
  const [preferences, setPreferences] = useState<CustomPreferences>({});
  const [preferenceDefaults, setPreferenceDefaults] = useState<CustomPreferences>({});
  const [preferenceConfigLoading, setPreferenceConfigLoading] = useState(true);
  const [preferenceConfigError, setPreferenceConfigError] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedPlaceSlug, setSelectedPlaceSlug] = useState('');
  const [selectedRouteSlug, setSelectedRouteSlug] = useState('');
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>('idle');
  const [checkoutError, setCheckoutError] = useState('');
  const [bookingOrder, setBookingOrder] = useState<SafeOrderSummary | null>(null);
  const [bookingStatus, setBookingStatus] = useState<BookingConfirmedStatus>('loading');
  const [bookingError, setBookingError] = useState('');
  const [bookingViewMode, setBookingViewMode] = useState<'success' | 'detail'>('success');
  const [bookingReturnView, setBookingReturnView] = useState<MobileView>('tabs');
  const [myOrders, setMyOrders] = useState<SafeOrderSummary[]>([]);
  const [myOrdersStatus, setMyOrdersStatus] = useState<MyOrdersStatus>('loading');
  const [myOrdersError, setMyOrdersError] = useState('');
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [authStep, setAuthStep] = useState<'email' | 'code'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpResendIn, setOtpResendIn] = useState(0);
  const [departures, setDepartures] = useState<GroupTourDeparture[]>([]);
  const [departuresLoading, setDeparturesLoading] = useState(true);
  const [departuresError, setDeparturesError] = useState('');
  const [featuredDepartures, setFeaturedDepartures] = useState<GroupTourDeparture[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [selectedFeaturedDepartureId, setSelectedFeaturedDepartureId] = useState('');
  const [postSignInCheckoutDraft, setPostSignInCheckoutDraft] = useState<GroupRequestDraft | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingHandledRef = useRef(false);
  const routeDeepLinkHandledRef = useRef(false);
  const bookingIdentifiersRef = useRef<{ orderNumber: string; sessionId?: string } | null>(null);
  const [bookingClaimProof, setBookingClaimProof] = useState<{
    orderNumber: string;
    sessionId?: string;
  } | null>(null);
  const bookingOrderRef = useRef<SafeOrderSummary | null>(null);
  const syncAuthFromStorage = () => {
    const session = readStoredAuthSession();
    setAuthUser(session?.user ?? null);
    return session;
  };

  useEffect(() => {
    if (otpResendIn <= 0) return;
    const timer = window.setTimeout(() => setOtpResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpResendIn]);

  const isSignedIn = Boolean(authUser);

  const selectedDestination = destinationMeta.find((destination) => destination.slug === draft.destinationSlug);
  const selectedRoute = routeTours.find((tour) => tour.slug === draft.routeSlug);
  const selectedDeparture = departures.find((departure) => departure.id === draft.departureId);
  const selectedPlaceDetail = destinationMeta.find((destination) => destination.slug === selectedPlaceSlug);
  const selectedRouteDetail = routeTours.find((tour) => tour.slug === selectedRouteSlug);
  const selectedFeaturedDeparture =
    featuredDepartures.find((departure) => departure.id === selectedFeaturedDepartureId) ||
    departures.find((departure) => departure.id === selectedFeaturedDepartureId);
  const selectedPlaceTours = selectedPlaceDetail
    ? routeTours.filter((tour) => tour.destinationSlugs.includes(selectedPlaceDetail.slug))
    : [];

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = subscribeAuthSession((session) => {
      if (!cancelled) setAuthUser(session?.user ?? null);
    });
    const onFocus = () => {
      syncAuthFromStorage();
    };
    window.addEventListener('focus', onFocus);

    if (consumePostAuthMeFocus()) {
      setActiveTab('me');
      setActiveView('tabs');
    }

    consumeAuthRedirectSession()
      .then((session) => {
        if (!session || cancelled) return;

        const intent = consumePendingAuthIntent();
        const pendingGroupDraft = intent === 'checkout' ? consumePendingGroupDraft() : null;
        setAuthUser(session.user);
        setDraft((current) =>
          normalizeGroupDraft({
            ...(pendingGroupDraft ?? current),
            email: pendingGroupDraft?.email || current.email || session.user.email,
          }),
        );
        setAuthStatus('idle');
        setAuthError('');
        setAuthMessage('');

        if (intent === 'checkout') {
          setPostSignInCheckoutDraft(pendingGroupDraft ? normalizeGroupDraft(pendingGroupDraft) : null);
        } else {
          setActiveTab('me');
          setActiveView('tabs');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setAuthStatus('error');
        setAuthError(error instanceof Error ? error.message : 'We could not complete sign-in.');
        setActiveView('signIn');
      });

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    bookingOrderRef.current = bookingOrder;
  }, [bookingOrder]);

  useEffect(() => {
    if (bookingHandledRef.current) return;
    if (searchParams.get('checkout') !== 'success') return;

    bookingHandledRef.current = true;

    const orderNumber = searchParams.get('order') || '';
    const sessionId = searchParams.get('session_id') || undefined;

    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    next.delete('order');
    next.delete('session_id');
    setSearchParams(next, { replace: true });

    if (!orderNumber && !sessionId) return;

    setActiveTab('home');
    setActiveView('bookingConfirmed');
    setBookingViewMode('success');
    setBookingReturnView('tabs');
    bookingIdentifiersRef.current = { orderNumber, sessionId };
    setBookingClaimProof(
      orderNumber && sessionId ? { orderNumber, sessionId } : null,
    );
    setBookingStatus('loading');
    setBookingError('');

    fetchOrderSummary(orderNumber, undefined, sessionId)
      .then((result) => {
        if (result.ok) {
          setBookingOrder(result.order);
          setBookingStatus('ready');
        } else {
          setBookingError(result.error);
          setBookingStatus('error');
        }
      })
      .catch(() => {
        setBookingError('We could not load your booking.');
        setBookingStatus('error');
      });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (bookingStatus !== 'ready') return;
    const identifiers = bookingIdentifiersRef.current;
    if (!identifiers) return;

    const maxAttempts = 12;
    let attempts = 0;

    const interval = setInterval(() => {
      const current = bookingOrderRef.current;
      if (!current || current.status === 'confirmed' || attempts >= maxAttempts) {
        clearInterval(interval);
        return;
      }

      attempts += 1;
      fetchOrderSummary(identifiers.orderNumber, undefined, identifiers.sessionId)
        .then((result) => {
          if (result.ok) {
            setBookingOrder(result.order);
            if (result.order.status === 'confirmed') clearInterval(interval);
          }
        })
        .catch(() => {
          // Ignore polling errors; keep the existing booking visible.
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [bookingStatus]);

  useEffect(() => {
    if (!postSignInCheckoutDraft || (!departures.length && !departuresError)) return;

    if (hasCompleteGroupDraft(postSignInCheckoutDraft, departures)) {
      setActiveView('reserveReview');
    } else {
      setActiveView('groupRequest');
      setCheckoutStatus('error');
      setCheckoutError('Sign-in is complete. Please choose your departure again before payment.');
    }

    setPostSignInCheckoutDraft(null);
  }, [postSignInCheckoutDraft, departures, departuresError]);

  useEffect(() => {
    let cancelled = false;

    async function loadDepartures() {
      try {
        const response = await fetch('/api/departures');
        const result = (await response.json().catch(() => ({ ok: false, error: 'Unexpected response.' }))) as
          | { ok: true; departures: Parameters<typeof mapApiDepartureToUi>[0][] }
          | { ok: false; error: string };

        if (cancelled) return;

        if (!response.ok || !result.ok || !Array.isArray(result.departures)) {
          setDeparturesError(result.ok === false ? result.error : 'We could not load departures.');
          setDeparturesLoading(false);
          return;
        }

        setDepartures(result.departures.map(mapApiDepartureToUi));
      } catch (error) {
        if (cancelled) return;
        setDeparturesError(error instanceof Error ? error.message : 'We could not load departures.');
      } finally {
        if (!cancelled) setDeparturesLoading(false);
      }
    }

    async function loadFeaturedDepartures() {
      try {
        const response = await fetch('/api/departures?featured=1');
        const result = (await response.json().catch(() => ({ ok: false }))) as
          | { ok: true; departures: Parameters<typeof mapApiDepartureToUi>[0][] }
          | { ok: false; error?: string };

        if (cancelled) return;

        if (!response.ok || !result.ok || !Array.isArray(result.departures)) {
          setFeaturedDepartures([]);
          return;
        }

        setFeaturedDepartures(result.departures.map(mapApiDepartureToUi));
      } catch {
        if (!cancelled) setFeaturedDepartures([]);
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    }

    loadDepartures();
    loadFeaturedDepartures();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchCustomTripFormConfig()
      .then((config) => {
        if (cancelled) return;
        setPreferenceFields(config.fields);
        setPreferences(config.defaults);
        setPreferenceDefaults(config.defaults);
        setRoutePrivatePreferences(config.defaults);
        setPreferenceConfigError('');
      })
      .catch((error) => {
        if (cancelled) return;
        setPreferenceConfigError(
          error instanceof Error ? error.message : 'We could not load preference options.',
        );
      })
      .finally(() => {
        if (!cancelled) setPreferenceConfigLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = (field: keyof GroupRequestDraft, value: string | number) => {
    setCheckoutError('');
    setCheckoutStatus('idle');
    setDraft((current) => {
      if (field === 'adultQuantity') {
        const adultQuantity = Math.max(1, Number(value) || 1);
        const travelers = resizeTravelers(current.travelers, adultQuantity, current.name);
        return {
          ...current,
          adultQuantity,
          travelers,
          name: travelers[0]?.name ?? '',
        };
      }

      return {
        ...current,
        [field]: value,
        ...(field === 'destinationSlug' ? { routeSlug: '', departureId: '', dateRange: '' } : {}),
        ...(field === 'routeSlug' ? { departureId: '', dateRange: '' } : {}),
      };
    });
  };

  const updateTravelerName = (index: number, name: string) => {
    setCheckoutError('');
    setCheckoutStatus('idle');
    setDraft((current) => {
      const travelers = current.travelers.map((traveler, travelerIndex) =>
        travelerIndex === index ? { name } : traveler,
      );
      return {
        ...current,
        travelers,
        name: travelers[0]?.name ?? '',
      };
    });
  };

  const updateGroupPhone = (countryCode: string, nationalNumber: string) => {
    setCheckoutError('');
    setCheckoutStatus('idle');
    setDraft((current) => ({
      ...current,
      phoneCountry: countryCode,
      phoneNational: nationalNumber,
      phone: buildInternationalPhone(countryCode, nationalNumber),
    }));
  };

  const updateCustomPhone = (countryCode: string, nationalNumber: string) => {
    setCustomFieldErrors({});
    setCustomFormError('');
    setCustomStatus('idle');
    setCustomMessage('');
    setCustomDraft((current) => ({
      ...current,
      phoneCountry: countryCode,
      phoneNational: nationalNumber,
      phone: buildInternationalPhone(countryCode, nationalNumber),
    }));
  };

  const updatePreference = (fieldKey: string, value: unknown) => {
    setCustomFieldErrors((current) => {
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
    setCustomFormError('');
    setCustomStatus('idle');
    setPreferences((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  };

  const updateRoutePrivatePreference = (fieldKey: string, value: unknown) => {
    setRoutePrivateFieldErrors((current) => {
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
    setRoutePrivateFormError('');
    setRoutePrivateStatus('idle');
    setRoutePrivatePreferences((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  };

  const selectDeparture = (departure: GroupTourDeparture) => {
    const route = getRouteBySlug(departure.routeSlug);

    setCheckoutError('');
    setCheckoutStatus('idle');
    setDraft((current) => {
      const adultQuantity = Math.min(current.adultQuantity, Math.max(1, departure.spotsLeft));
      const travelers = resizeTravelers(current.travelers, adultQuantity, current.name);
      return {
        ...current,
        destinationSlug: route?.destinationSlugs[0] ?? current.destinationSlug,
        routeSlug: departure.routeSlug,
        departureId: departure.id,
        dateRange: formatDepartureDateRange(departure),
        adultQuantity,
        travelers,
        name: travelers[0]?.name ?? '',
      };
    });
  };

  const openCustomTab = () => {
    setActiveTab('custom');
    setActiveView('tabs');
  };

  const openGroupRequest = () => {
    setCheckoutStatus('idle');
    setCheckoutError('');
    setActiveView('groupRequest');
  };

  const openAllGroupDepartures = () => {
    setDraft((current) => ({
      ...current,
      routeSlug: '',
      departureId: '',
      dateRange: '',
    }));
    openGroupRequest();
  };

  const openFeaturedGroupDetail = (departureId: string) => {
    setSelectedFeaturedDepartureId(departureId);
    setActiveView('featuredGroupDetail');
  };

  const bookFeaturedDeparture = (departure: GroupTourDeparture) => {
    setDepartures((current) =>
      current.some((item) => item.id === departure.id) ? current : [departure, ...current],
    );
    selectDeparture(departure);
    openGroupRequest();
  };

  const openPlaceDetail = (slug: string, returnView: MobileView = 'tabs') => {
    setSelectedPlaceSlug(slug);
    setPlaceDetailReturnView(returnView);
    setActiveView('placeDetail');
  };

  const openRouteDetail = (slug: string, returnView: MobileView = 'tabs') => {
    setSelectedRouteSlug(slug);
    setRouteDetailReturnView(returnView);
    setActiveView('routeDetail');
  };

  useEffect(() => {
    if (routeDeepLinkHandledRef.current) return;
    const routeSlug = searchParams.get('route');
    if (!routeSlug) return;

    routeDeepLinkHandledRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('route');
    setSearchParams(next, { replace: true });

    if (routeTours.some((tour) => tour.slug === routeSlug)) {
      openRouteDetail(routeSlug, 'tabs');
    }
  }, [searchParams, setSearchParams]);

  const openGroupFromPlace = (destination: (typeof destinationMeta)[number]) => {
    setDraft((current) => ({
      ...current,
      destinationSlug: destination.slug,
      routeSlug: '',
      departureId: '',
      dateRange: '',
    }));
    openGroupRequest();
  };

  const openGroupFromRoute = (tour: (typeof routeTours)[number]) => {
    const routeDepartures = departures.filter((departure) => departure.routeSlug === tour.slug);
    if (routeDepartures.length === 0) {
      openRoutePrivateFromRoute(
        tour,
        'No group tour departures are available for this route yet. Tell us your dates and we will plan a private trip based on it.',
      );
      return;
    }

    const firstDeparture = routeDepartures[0];

    setDraft((current) => ({
      ...current,
      destinationSlug: tour.destinationSlugs[0] ?? current.destinationSlug,
      routeSlug: tour.slug,
      departureId: firstDeparture.id,
      dateRange: formatDepartureDateRange(firstDeparture),
    }));
    openGroupRequest();
  };

  const openCustomFromPlace = (destination: (typeof destinationMeta)[number]) => {
    setCustomFieldErrors({});
    setCustomFormError('');
    setCustomStatus('idle');
    setCustomMessage('');
    setCustomDraft((current) => ({
      ...current,
      destinations: Array.from(new Set([...current.destinations, destination.name])),
      message:
        current.message ||
        `I am interested in ${destination.name}. Please help plan a private China trip around my dates, pace, hotels, and must-see places.`,
    }));
    openCustomTab();
  };

  const openRoutePrivateFromRoute = (
    tour: (typeof routeTours)[number],
    hint = '',
  ) => {
    setRoutePrivateFieldErrors({});
    setRoutePrivateFormError('');
    setRoutePrivateStatus('idle');
    setRoutePrivateMessage('');
    setRoutePrivateHint(hint);
    setRoutePrivateTurnstileToken('');
    setRoutePrivateTurnstileResetSignal((current) => current + 1);
    setRoutePrivatePreferences(preferenceDefaults);
    setRoutePrivateDraft((current) => ({
      ...initialRoutePrivateDraft,
      name: current.name,
      email: current.email,
      phoneCountry: current.phoneCountry,
      phoneNational: current.phoneNational,
      phone: current.phone,
    }));
    setSelectedRouteSlug(tour.slug);
    setActiveView('routePrivateRequest');
  };

  const openCustomFromRoute = (tour: (typeof routeTours)[number]) => {
    openRoutePrivateFromRoute(tour);
  };

  const updateCustomDraft = (field: CustomTextField, value: string) => {
    setCustomFieldErrors({});
    setCustomFormError('');
    setCustomStatus('idle');
    setCustomMessage('');
    setCustomDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateRoutePrivateDraft = (field: Exclude<keyof RoutePrivateDraft, 'datesFlexible'>, value: string) => {
    setRoutePrivateFieldErrors({});
    setRoutePrivateFormError('');
    setRoutePrivateStatus('idle');
    setRoutePrivateMessage('');
    setRoutePrivateDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateRoutePrivateDatesFlexible = (flexible: boolean) => {
    setRoutePrivateFieldErrors({});
    setRoutePrivateFormError('');
    setRoutePrivateStatus('idle');
    setRoutePrivateMessage('');
    setRoutePrivateDraft((current) => ({
      ...current,
      datesFlexible: flexible,
      travelMonth: flexible ? '' : current.travelMonth,
    }));
  };

  const updateRoutePrivatePhone = (countryCode: string, nationalNumber: string) => {
    setRoutePrivateFieldErrors({});
    setRoutePrivateFormError('');
    setRoutePrivateStatus('idle');
    setRoutePrivateMessage('');
    setRoutePrivateDraft((current) => ({
      ...current,
      phoneCountry: countryCode,
      phoneNational: nationalNumber,
      phone: buildInternationalPhone(countryCode, nationalNumber),
    }));
  };

  const toggleCustomChoice = (field: CustomChoiceField, value: string) => {
    setCustomFieldErrors({});
    setCustomFormError('');
    setCustomStatus('idle');
    setCustomMessage('');
    setCustomDraft((current) => {
      const choices = current[field];
      const nextChoices = choices.includes(value)
        ? choices.filter((choice) => choice !== value)
        : [...choices, value];

      return {
        ...current,
        [field]: nextChoices,
      };
    });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveView('searchResults');
  };

  const submitCustomTrip = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;

    const honeypot = String(new FormData(formElement).get('companyWebsite') ?? '').trim();
    const nextErrors: FieldErrors = {};
    const email = customDraft.email.trim().toLowerCase();
    const hasDestination = customDraft.destinations.length > 0 || Boolean(customDraft.otherDestination.trim());
    const hasTiming = Boolean(customDraft.travelMonth.trim() || customDraft.travelers || customDraft.tripLength);

    if (!hasDestination) nextErrors.destinations = 'Choose at least one destination or use Other place.';
    if (!hasTiming) nextErrors.timing = 'Share at least one travel date, group size, or trip length detail.';
    Object.assign(nextErrors, validatePreferenceAnswers(preferenceFields, preferences));
    if (!customDraft.name.trim()) nextErrors.name = 'Enter your full name.';
    if (!email) nextErrors.email = 'Enter your email address.';
    else if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    const phoneError = validateOptionalPhoneInput(customDraft.phoneCountry, customDraft.phoneNational);
    if (phoneError) nextErrors.phone = phoneError;
    if (!customTurnstileToken) nextErrors.turnstile = 'Complete the anti-spam check.';

    const preferenceKeys = [
      ...preferenceFieldsByGroup(preferenceFields, 'basic').map((field) => field.fieldKey),
      ...preferenceFieldsByGroup(preferenceFields, 'more').map((field) => field.fieldKey),
    ];
    const fieldOrder = [
      'destinations',
      'timing',
      ...preferenceKeys,
      'name',
      'email',
      'phone',
      'turnstile',
    ];

    setCustomFieldErrors(nextErrors);
    setCustomFormError('');
    if (Object.keys(nextErrors).length) {
      setCustomStatus('error');
      setCustomMessage('');
      if (Object.keys(nextErrors).some((key) => preferenceKeys.includes(key) && preferenceFieldsByGroup(preferenceFields, 'more').some((field) => field.fieldKey === key))) {
        setMoreOpen(true);
      }
      requestAnimationFrame(() => {
        focusFirstFieldError(fieldOrder, nextErrors, formElement);
      });
      return;
    }

    setCustomStatus('loading');
    setCustomMessage('');

    try {
      await submitInquiry({
        type: 'custom_trip',
        name: customDraft.name.trim(),
        email,
        phone: customDraft.phone.trim(),
        destinations: customDraft.destinations,
        otherDestination: customDraft.otherDestination.trim(),
        travelMonth: customDraft.travelMonth.trim(),
        travelers: customDraft.travelers,
        tripLength: customDraft.tripLength,
        supportPreference: customDraft.contactPreferences.join(', '),
        interests: customDraft.interests,
        message: customDraft.message.trim(),
        customPreferences: preferences,
        sourcePath: `${window.location.pathname}${window.location.hash}`,
        turnstileToken: customTurnstileToken,
        honeypot,
      });

      setCustomDraft(initialCustomDraft);
      setPreferences(preferenceDefaults);
      setMoreOpen(false);
      setCustomFieldErrors({});
      setCustomFormError('');
      setCustomStatus('success');
      setCustomMessage('Request sent. We will reply within 24 hours with realistic route ideas and next steps.');
      setCustomTurnstileToken('');
      setCustomTurnstileResetSignal((value) => value + 1);
    } catch (error) {
      setCustomStatus('error');
      setCustomFormError(error instanceof Error ? error.message : 'We could not submit your request. Please try again.');
    }
  };

  const submitRoutePrivate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const tour = selectedRouteDetail;
    if (!tour) return;

    const honeypot = String(new FormData(formElement).get('companyWebsite') ?? '').trim();
    const nextErrors: FieldErrors = {};
    const email = routePrivateDraft.email.trim().toLowerCase();
    const routePrivateFields = preferenceFieldsForRoutePrivate(preferenceFields);

    if (
      (!routePrivateDraft.datesFlexible && !routePrivateDraft.travelMonth.trim()) ||
      !routePrivateDraft.travelers
    ) {
      nextErrors.timing = routePrivateDraft.datesFlexible
        ? 'Share your group size.'
        : 'Share your preferred start date and group size.';
    }
    Object.assign(nextErrors, validatePreferenceAnswers(routePrivateFields, routePrivatePreferences));
    if (!routePrivateDraft.name.trim()) nextErrors.name = 'Enter your full name.';
    if (!email) nextErrors.email = 'Enter your email address.';
    else if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    const phoneError = validateOptionalPhoneInput(
      routePrivateDraft.phoneCountry,
      routePrivateDraft.phoneNational,
    );
    if (phoneError) nextErrors.phone = phoneError;
    if (!routePrivateTurnstileToken) nextErrors.turnstile = 'Complete the anti-spam check.';

    const preferenceKeys = routePrivateFields.map((field) => field.fieldKey);
    const fieldOrder = ['timing', ...preferenceKeys, 'name', 'email', 'phone', 'turnstile'];

    setRoutePrivateFieldErrors(nextErrors);
    setRoutePrivateFormError('');
    if (Object.keys(nextErrors).length) {
      setRoutePrivateStatus('error');
      setRoutePrivateMessage('');
      requestAnimationFrame(() => {
        focusFirstFieldError(fieldOrder, nextErrors, formElement);
      });
      return;
    }

    setRoutePrivateStatus('loading');
    setRoutePrivateMessage('');

    const basicPreferences: CustomPreferences = {};
    for (const field of routePrivateFields) {
      basicPreferences[field.fieldKey] = routePrivatePreferences[field.fieldKey];
    }

    const durationDays =
      tour.durationDays > 0 ? tour.durationDays : Number.parseInt(tour.duration, 10) || 0;
    const startDate = routePrivateDraft.travelMonth.trim();
    const endDate =
      !routePrivateDraft.datesFlexible && startDate && durationDays
        ? endDateFromDuration(startDate, durationDays)
        : '';
    const travelMonth = routePrivateDraft.datesFlexible
      ? 'Flexible'
      : endDate
        ? `${startDate} to ${endDate}`
        : startDate;
    const dateNote = routePrivateDraft.datesFlexible
      ? 'Preferred dates: flexible.'
      : endDate
        ? `Preferred dates: ${startDate} to ${endDate} (${durationDays}-day route).`
        : startDate
          ? `Preferred start date: ${startDate}.`
          : '';
    const userMessage = routePrivateDraft.message.trim();
    const combinedMessage = [dateNote, userMessage].filter(Boolean).join('\n\n');

    try {
      await submitInquiry({
        type: 'route_private',
        name: routePrivateDraft.name.trim(),
        email,
        phone: routePrivateDraft.phone.trim(),
        destinations: getRouteDestinationNames(tour),
        travelMonth,
        travelers: routePrivateDraft.travelers,
        tripLength: tour.duration,
        message: combinedMessage,
        customPreferences: basicPreferences,
        requestedTour: tour.slug,
        sourcePath: `${window.location.pathname}${window.location.hash}`,
        turnstileToken: routePrivateTurnstileToken,
        honeypot,
      });

      setRoutePrivateDraft(initialRoutePrivateDraft);
      setRoutePrivatePreferences(preferenceDefaults);
      setRoutePrivateFieldErrors({});
      setRoutePrivateFormError('');
      setRoutePrivateHint('');
      setRoutePrivateStatus('success');
      setRoutePrivateMessage(
        'Request sent. We will reply within 24 hours with a private plan based on this route.',
      );
      setRoutePrivateTurnstileToken('');
      setRoutePrivateTurnstileResetSignal((value) => value + 1);
    } catch (error) {
      setRoutePrivateStatus('error');
      setRoutePrivateFormError(
        error instanceof Error ? error.message : 'We could not submit your request. Please try again.',
      );
    }
  };

  const beginSignIn = (intent: AuthIntent) => {
    if (intent === 'checkout') {
      savePendingGroupDraft(draft);
    }

    setAuthIntent(intent);
    setAuthStatus('idle');
    setAuthMessage('');
    setAuthError('');
    setAuthStep('email');
    setOtpCode('');
    setOtpResendIn(0);
    setActiveView('signIn');
  };

  const loadMyOrders = async () => {
    const session = syncAuthFromStorage();
    if (!session?.accessToken) {
      setMyOrders([]);
      setMyOrdersError('Sign in to view your orders.');
      setMyOrdersStatus('error');
      setActiveView('signIn');
      setAuthIntent('account');
      return;
    }

    setMyOrdersStatus('loading');
    setMyOrdersError('');

    try {
      const result = await fetchMyOrders(session.accessToken);
      if (result.ok) {
        setMyOrders(result.orders);
        setMyOrdersStatus('ready');
        return;
      }

      setMyOrders([]);
      if (result.unauthorized) {
        clearStoredAuthSession();
        setAuthUser(null);
        setMyOrdersError('Sign in to view your orders.');
        setMyOrdersStatus('error');
        setActiveView('signIn');
        setAuthIntent('account');
        return;
      }

      setMyOrdersError(result.error);
      setMyOrdersStatus('error');
    } catch {
      setMyOrders([]);
      setMyOrdersError('We could not load your orders.');
      setMyOrdersStatus('error');
    }
  };

  const openMyOrders = () => {
    const session = syncAuthFromStorage();
    if (!session?.accessToken) {
      beginSignIn('account');
      return;
    }
    setActiveView('myOrders');
    void loadMyOrders();
  };

  const openOrderFromList = (order: SafeOrderSummary) => {
    setBookingOrder(order);
    setBookingStatus('ready');
    setBookingError('');
    setBookingViewMode('detail');
    setBookingReturnView('myOrders');
    setActiveView('bookingConfirmed');
  };

  const handleBookingBack = () => {
    if (bookingReturnView === 'myOrders') {
      setActiveView('myOrders');
      return;
    }
    setActiveTab('home');
    setActiveView('tabs');
  };

  const handleProviderSignIn = async (provider: AuthProvider, intent = authIntent) => {
    setAuthStatus('idle');
    setAuthMessage('');
    setAuthError('');

    if (provider === 'email') {
      beginSignIn(intent);
      return;
    }

    if (intent === 'checkout') {
      savePendingGroupDraft(draft);
    }

    // Always surface OAuth on the Sign In screen — Me tab has no error/loading UI.
    setAuthIntent(intent);
    setAuthStep('email');
    setActiveView('signIn');

    if (!isAuthConfigured()) {
      setAuthStatus('error');
      setAuthError('Supabase Auth is not configured.');
      return;
    }

    setAuthStatus('loading');

    try {
      await signInWithOAuth(provider, intent);
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error instanceof Error ? error.message : 'We could not start sign-in.');
    }
  };

  const finishEmailOtpSession = async (sessionUser: AuthUser) => {
    setAuthUser(sessionUser);
    setAuthStep('email');
    setOtpCode('');
    setAuthStatus('idle');
    setAuthError('');
    setAuthMessage('');

    if (authIntent === 'checkout') {
      setPostSignInCheckoutDraft(
        normalizeGroupDraft({
          ...draft,
          email: draft.email || sessionUser.email,
        }),
      );
      return;
    }

    markPostAuthMeFocus();
    setActiveTab('me');
    setActiveView('tabs');
  };

  const submitEmailSignIn = async () => {
    const email = draft.email.trim().toLowerCase();
    setAuthMessage('');
    setAuthError('');

    if (!isValidEmail(email)) {
      setAuthStatus('error');
      setAuthError('Enter a valid email address first.');
      requestAnimationFrame(() => {
        focusFirstFieldError(['email'], { email: 'Enter a valid email address first.' });
      });
      return;
    }

    if (!isAuthConfigured()) {
      setAuthStatus('error');
      setAuthError('Supabase Auth is not configured.');
      return;
    }

    setAuthStatus('loading');

    try {
      if (authIntent === 'checkout') {
        savePendingGroupDraft({
          ...draft,
          email,
        });
      }
      await sendEmailOtp(email, authIntent);
      setAuthStep('code');
      setOtpResendIn(60);
      setAuthStatus('message');
      setAuthMessage('We sent a 6-digit code to your email. Enter it below.');
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error instanceof Error ? error.message : 'We could not send the sign-in code.');
    }
  };

  const submitEmailOtpVerify = async () => {
    const email = draft.email.trim().toLowerCase();
    setAuthMessage('');
    setAuthError('');

    if (otpCode.trim().length < 6) {
      setAuthStatus('error');
      setAuthError('Enter the 6-digit code from your email.');
      return;
    }

    setAuthStatus('loading');
    try {
      const session = await verifyEmailOtp(email, otpCode);
      await finishEmailOtpSession(session.user);
    } catch (error) {
      setAuthStatus('error');
      setAuthError(error instanceof Error ? error.message : 'We could not verify that code.');
    }
  };

  const resendEmailOtp = async () => {
    if (otpResendIn > 0) return;
    await submitEmailSignIn();
  };

  const handleAccountSignIn = (provider: AuthProvider) => {
    void handleProviderSignIn(provider, 'account');
  };

  const submitCheckout = async () => {
    const checkoutEmail = draft.email.trim().toLowerCase();
    const travelerError = validateTravelerNames(draft.travelers, draft.adultQuantity);
    const phoneError = validateOptionalPhoneInput(draft.phoneCountry, draft.phoneNational);

    if (!selectedDeparture) {
      setCheckoutStatus('error');
      setCheckoutError('Please choose an available departure first.');
      return;
    }

    if (travelerError) {
      setCheckoutStatus('error');
      setCheckoutError(travelerError.message);
      return;
    }

    if (!isValidEmail(checkoutEmail)) {
      setCheckoutStatus('error');
      setCheckoutError('Please enter a valid email address.');
      return;
    }

    if (phoneError) {
      setCheckoutStatus('error');
      setCheckoutError(phoneError);
      return;
    }

    setCheckoutStatus('loading');
    setCheckoutError('');

    const authSession = readStoredAuthSession();
    const travelers = draft.travelers.map((traveler) => ({ name: traveler.name.trim() }));

    try {
      const result = await createFixedDepartureCheckoutSession({
        departureId: selectedDeparture.id,
        adultQuantity: draft.adultQuantity,
        name: travelers[0]?.name || draft.name.trim(),
        email: checkoutEmail,
        travelers,
        phone: draft.phone.trim() || undefined,
        notes: draft.notes.trim(),
        accessToken: authSession?.accessToken,
      });

      window.location.assign(result.checkoutUrl!);
    } catch (error) {
      setCheckoutStatus('error');
      setCheckoutError(error instanceof Error ? error.message : 'We could not open Stripe Checkout. Please try again.');
    }
  };

  let view: ReactNode = null;

  if (activeView === 'groupRequest') {
    if (departuresLoading) {
      view = (
        <motion.div
          key="groupRequest-loading"
          className="china-trips-mobile-page iosapp-page"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="iosapp-screen flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading departures...</p>
          </div>
        </motion.div>
      );
    } else if (departuresError) {
      view = (
        <motion.div
          key="groupRequest-error"
          className="china-trips-mobile-page iosapp-page"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="iosapp-screen flex flex-col items-center justify-center gap-4 p-8">
            <p className="text-destructive text-center">{departuresError}</p>
            <button
              type="button"
              className="iosapp-button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </motion.div>
      );
    } else {
      view = (
        <motion.div key="groupRequest" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <GroupRequestView
            draft={draft}
            selectedDeparture={selectedDeparture}
            departures={departures}
            onBack={() => setActiveView('tabs')}
            onDraftChange={updateDraft}
            onTravelerNameChange={updateTravelerName}
            onPhoneChange={updateGroupPhone}
            onSelectDeparture={selectDeparture}
            onViewItinerary={(routeSlug) => openRouteDetail(routeSlug, 'groupRequest')}
            onContinue={() => setActiveView('reserveReview')}
          />
        </motion.div>
      );
    }
  } else if (activeView === 'signIn') {
    view = (
      <motion.div key="signIn" variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <SignInView
          email={draft.email}
          otpCode={otpCode}
          authStep={authStep}
          authStatus={authStatus}
          authMessage={authMessage}
          authError={authError}
          resendIn={otpResendIn}
          onBack={() => {
            if (authStep === 'code') {
              setAuthStep('email');
              setOtpCode('');
              setAuthError('');
              setAuthMessage('');
              return;
            }
            if (authIntent === 'account') {
              setActiveTab('me');
              setActiveView('tabs');
            } else {
              setActiveView('groupRequest');
            }
          }}
          onEmailChange={(value) => updateDraft('email', value)}
          onOtpChange={setOtpCode}
          onProviderSignIn={(provider) => void handleProviderSignIn(provider)}
          onEmailSignIn={() => void submitEmailSignIn()}
          onVerifyOtp={() => void submitEmailOtpVerify()}
          onResendOtp={() => void resendEmailOtp()}
          onEditEmail={() => {
            setAuthStep('email');
            setOtpCode('');
            setAuthError('');
            setAuthMessage('');
          }}
        />
      </motion.div>
    );
  } else if (activeView === 'reserveReview') {
    view = (
      <motion.div key="reserveReview" variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <ReserveReviewView
          selectedDestinationName={selectedDestination?.name ?? ''}
          selectedRouteTitle={selectedRoute?.title ?? ''}
          selectedDeparture={selectedDeparture}
          draft={draft}
          checkoutStatus={checkoutStatus}
          checkoutError={checkoutError}
          onBack={() => setActiveView('groupRequest')}
          onSubmitCheckout={submitCheckout}
        />
      </motion.div>
    );
  } else if (activeView === 'bookingConfirmed') {
    view = (
      <motion.div key="bookingConfirmed" variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <BookingConfirmedView
          order={bookingOrder}
          status={bookingStatus}
          error={bookingError}
          mode={bookingViewMode}
          claimProof={bookingViewMode === 'success' ? bookingClaimProof : null}
          onLinkedOrder={() => void loadMyOrders()}
          onBack={handleBookingBack}
        />
      </motion.div>
    );
  } else if (activeView === 'myOrders') {
    view = (
      <motion.div key="myOrders" variants={pageVariants} initial="initial" animate="animate" exit="exit">
        <MyOrdersView
          email={authUser?.email}
          status={myOrdersStatus}
          error={myOrdersError}
          orders={myOrders}
          onBack={() => {
            setActiveTab('me');
            setActiveView('tabs');
          }}
          onExplore={() => {
            setActiveTab('home');
            setActiveView('tabs');
          }}
          onOpenOrder={openOrderFromList}
          onRetry={() => void loadMyOrders()}
          onLinkedOrder={() => void loadMyOrders()}
        />
      </motion.div>
    );
  } else if (activeView === 'searchResults') {
    view = (
      <SearchResultsView
        key="searchResults"
        query={query}
        onQueryChange={setQuery}
        onSearch={submitSearch}
        onBack={() => setActiveView('tabs')}
        onOpenPlace={(slug) => openPlaceDetail(slug, 'searchResults')}
        onOpenRoute={(slug) => openRouteDetail(slug, 'searchResults')}
      />
    );
  } else if (activeView === 'placeDetail' && selectedPlaceDetail) {
    view = (
      <PlaceDetailView
        key="placeDetail"
        destination={selectedPlaceDetail}
        tours={selectedPlaceTours}
        onBack={() => setActiveView(placeDetailReturnView)}
        onOpenRoute={openRouteDetail}
        onOpenCustom={() => openCustomFromPlace(selectedPlaceDetail)}
        onOpenGroup={() => openGroupFromPlace(selectedPlaceDetail)}
      />
    );
  } else if (activeView === 'routeDetail' && selectedRouteDetail) {
    view = (
      <RouteDetailView
        key="routeDetail"
        tour={selectedRouteDetail}
        onBack={() => setActiveView(routeDetailReturnView)}
        onOpenCustom={() => openCustomFromRoute(selectedRouteDetail)}
        onOpenGroup={() => openGroupFromRoute(selectedRouteDetail)}
      />
    );
  } else if (activeView === 'routePrivateRequest' && selectedRouteDetail) {
    view = (
      <motion.div
        key="routePrivateRequest"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <RoutePrivateRequestView
          tour={selectedRouteDetail}
          draft={routePrivateDraft}
          status={routePrivateStatus}
          fieldErrors={routePrivateFieldErrors}
          formError={routePrivateFormError}
          message={routePrivateMessage}
          hint={routePrivateHint}
          turnstileResetSignal={routePrivateTurnstileResetSignal}
          preferenceFields={preferenceFields}
          preferences={routePrivatePreferences}
          configLoading={preferenceConfigLoading}
          configError={preferenceConfigError}
          onBack={() => setActiveView('routeDetail')}
          onFieldChange={updateRoutePrivateDraft}
          onDatesFlexibleChange={updateRoutePrivateDatesFlexible}
          onPhoneChange={updateRoutePrivatePhone}
          onPreferenceChange={updateRoutePrivatePreference}
          onTurnstileToken={setRoutePrivateTurnstileToken}
          onSubmit={(event) => void submitRoutePrivate(event)}
        />
      </motion.div>
    );
  } else if (activeView === 'featuredGroupDetail' && selectedFeaturedDeparture) {
    view = (
      <FeaturedGroupDetailView
        key="featuredGroupDetail"
        departure={selectedFeaturedDeparture}
        onBack={() => setActiveView('tabs')}
        onBook={() => bookFeaturedDeparture(selectedFeaturedDeparture)}
      />
    );
  } else {
    view = (
      <motion.div
        key="tabs"
        className="china-trips-mobile-page iosapp-page"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <main className="iosapp-screen iosapp-tab-screen">
          <AnimatePresence mode="wait" initial={false}>
            <TabContent
              key={activeTab}
              activeTab={activeTab}
              query={query}
              draft={draft}
              isSignedIn={isSignedIn}
              authUser={authUser}
              customDraft={customDraft}
              customStatus={customStatus}
              customFieldErrors={customFieldErrors}
              customFormError={customFormError}
              customMessage={customMessage}
              customTurnstileResetSignal={customTurnstileResetSignal}
              onQueryChange={setQuery}
              onSearch={submitSearch}
              onOpenCustom={openCustomTab}
              onOpenGroup={openAllGroupDepartures}
              onOpenFeaturedGroup={openFeaturedGroupDetail}
              featuredDepartures={featuredDepartures}
              featuredLoading={featuredLoading}
              onOpenPlace={openPlaceDetail}
              onOpenRoute={openRouteDetail}
              onSelectTab={setActiveTab}
              onSignIn={handleAccountSignIn}
              onOpenMyOrders={openMyOrders}
              onCustomFieldChange={updateCustomDraft}
              onCustomPhoneChange={updateCustomPhone}
              onCustomToggleChoice={toggleCustomChoice}
              onCustomTurnstileToken={setCustomTurnstileToken}
              onCustomSubmit={submitCustomTrip}
              preferenceFields={preferenceFields}
              preferences={preferences}
              moreOpen={moreOpen}
              preferenceConfigLoading={preferenceConfigLoading}
              preferenceConfigError={preferenceConfigError}
              onPreferenceChange={updatePreference}
              onMoreOpenChange={setMoreOpen}
            />
          </AnimatePresence>
        </main>
        <WhatsAppShortcut />
        <TabBar activeTab={activeTab} onSelect={setActiveTab} />
      </motion.div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        {view}
      </AnimatePresence>
    </MotionConfig>
  );
}

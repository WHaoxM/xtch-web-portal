import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import Seo from './components/Seo';
import Home from './pages/Home';
import Destinations from './pages/Destinations';
import ChinaTours from './pages/ChinaTours';
import CustomTrip from './pages/CustomTrip';
import TravelGuide from './pages/TravelGuide';
import GuideArticle from './pages/GuideArticle';
import About from './pages/About';
import Contact from './pages/Contact';
import Search from './pages/Search';
import DestinationDetail from './pages/DestinationDetail';
import RouteDetail from './pages/RouteDetail';
import GroupTours from './pages/GroupTours';
import TourCost from './pages/TourCost';
import FeaturedServices from './pages/FeaturedServices';
import PrivacyPolicy from './pages/PrivacyPolicy';
import OrderSuccess from './pages/OrderSuccess';
import Admin from './pages/Admin';
import Account from './pages/Account';
import AuthCallback from './pages/AuthCallback';
import NotFound from './pages/NotFound';
import { completeAuthRedirectNavigation, urlHasAuthTokens } from './lib/authClient';
import { ensureContentDataLoaded } from './lib/contentStore';
import PublicImBubble from './components/PublicImBubble';

/** Matches `chinaTripsMobile.css` Mini-App shell breakpoint (not `useIsMobile` 768). */
const MINI_APP_MAX_WIDTH_QUERY = '(max-width: 900px)';

function subscribeMiniAppViewport(onChange: () => void) {
  const media = window.matchMedia(MINI_APP_MAX_WIDTH_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getMiniAppViewportSnapshot() {
  return window.matchMedia(MINI_APP_MAX_WIDTH_QUERY).matches;
}

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin';
  const isAuthCallbackRoute = location.pathname === '/auth/callback';
  const isChinaTripsRoute =
    location.pathname === '/china-trips' || location.pathname === '/china-tours';
  const isMiniAppViewport = useSyncExternalStore(
    subscribeMiniAppViewport,
    getMiniAppViewportSnapshot,
    () => false,
  );
  // Always block first paint while URL still holds tokens — even if a prior session exists.
  // (Old logic skipped consumption when hasSession, leaving `#access_token=…` on Home.)
  const [authReady, setAuthReady] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !urlHasAuthTokens();
  });
  const [contentDataLoaded, setContentDataLoaded] = useState(false);
  const [contentDataFailed, setContentDataFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    ensureContentDataLoaded()
      .then(() => {
        if (!cancelled) {
          setContentDataFailed(false);
          setContentDataLoaded(true);
        }
      })
      .catch((error) => {
        console.error('Failed to load destinations/routes content:', error);
        if (!cancelled) {
          setContentDataLoaded(false);
          setContentDataFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authReady) return;

    let cancelled = false;

    async function handleAuthCallback() {
      try {
        // Root-level token dumps (#access_token=…) — consume and return to pending path.
        // Dedicated /auth/callback also handles this via AuthCallback page.
        if (urlHasAuthTokens() && location.pathname !== '/auth/callback') {
          await completeAuthRedirectNavigation();
        }
      } catch (error) {
        console.error('Auth redirect consumption failed:', error);
        // Strip broken tokens so the next paint is not stuck on `#access_token=…`.
        if (urlHasAuthTokens()) {
          const fallback =
            window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
              ? '/admin'
              : '/';
          window.history.replaceState(null, '', `${window.location.origin}${fallback}`);
        }
      }
      if (!cancelled) setAuthReady(true);
    }

    handleAuthCallback();

    return () => {
      cancelled = true;
    };
  }, [authReady, location.pathname]);

  const contentReady = isAdminRoute || isAuthCallbackRoute || contentDataLoaded;
  const hideSiteChrome =
    isAdminRoute || isAuthCallbackRoute || (isChinaTripsRoute && isMiniAppViewport);
  const publicImSource = isChinaTripsRoute && isMiniAppViewport ? 'portal_mobile' : 'portal_web';
  const showPublicIm = !isAdminRoute && !isAuthCallbackRoute;

  if (!authReady) return null;

  if (contentDataFailed && !isAdminRoute && !isAuthCallbackRoute) {
    return (
      <>
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
          <h1 className="font-serif text-[32px] text-[#002A3A]">Content temporarily unavailable</h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-[#5D5D5D]">
            We could not load destinations and routes. Please refresh the page in a moment.
          </p>
        </div>
        {showPublicIm && <PublicImBubble source={publicImSource} showTrigger={!isChinaTripsRoute || !isMiniAppViewport} />}
      </>
    );
  }

  if (!contentReady) {
    return showPublicIm ? (
      <PublicImBubble source={publicImSource} showTrigger={!isChinaTripsRoute || !isMiniAppViewport} />
    ) : null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Seo />
      <ScrollToTop />
      {!hideSiteChrome && <Navbar />}
      <main className={isAdminRoute ? 'flex-1 min-h-0' : 'flex-1'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/destinations/:slug" element={<DestinationDetail />} />
          <Route path="/china-trips" element={<ChinaTours />} />
          <Route path="/china-tours" element={<Navigate to="/china-trips" replace />} />
          <Route path="/group-tours" element={<GroupTours />} />
          <Route path="/tours/:slug" element={<RouteDetail />} />
          <Route path="/custom-trip" element={<CustomTrip />} />
          <Route path="/featured-services" element={<FeaturedServices />} />
          <Route path="/travel-guide" element={<TravelGuide />} />
          <Route path="/travel-guide/:slug" element={<GuideArticle />} />
          <Route path="/china-private-tour-cost" element={<TourCost />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/search" element={<Search />} />
          <Route path="/orders/:orderNumber" element={<OrderSuccess />} />
          <Route path="/account" element={<Account />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!hideSiteChrome && <Footer />}
      {showPublicIm && (
        <PublicImBubble source={publicImSource} showTrigger={!isChinaTripsRoute || !isMiniAppViewport} />
      )}
    </div>
  );
}

export default App;

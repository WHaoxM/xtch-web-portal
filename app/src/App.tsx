import { Routes, Route, useLocation } from 'react-router-dom';
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
import TourCost from './pages/TourCost';
import FeaturedServices from './pages/FeaturedServices';
import PrivacyPolicy from './pages/PrivacyPolicy';
import OrderSuccess from './pages/OrderSuccess';
import Admin from './pages/Admin';
import Account from './pages/Account';
import { consumeAuthRedirectSession, readStoredAuthSession } from './lib/authClient';
import { ensureContentDataLoaded } from './lib/contentStore';

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
  const isChinaTripsRoute =
    location.pathname === '/china-trips' || location.pathname === '/china-tours';
  const isMiniAppViewport = useSyncExternalStore(
    subscribeMiniAppViewport,
    getMiniAppViewportSnapshot,
    () => false,
  );
  const [authReady, setAuthReady] = useState(() => {
    const hasCallback = typeof window !== 'undefined' && window.location.hash.includes('access_token');
    const hasSession = typeof window !== 'undefined' && Boolean(readStoredAuthSession());
    return !hasCallback || hasSession;
  });
  const [contentDataLoaded, setContentDataLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    ensureContentDataLoaded()
      .catch((error) => {
        console.error('Failed to load destinations/routes content:', error);
      })
      .finally(() => {
        if (!cancelled) setContentDataLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function handleAuthCallback() {
      try {
        const session = await consumeAuthRedirectSession();
        if (cancelled) return;
        if (session) {
          window.location.hash = '#/account';
          return;
        }
      } catch {
        // Ignore callback errors; the current page will show its normal UI.
      }
      if (!cancelled) setAuthReady(true);
    }

    if (!authReady) {
      handleAuthCallback();
    }

    return () => {
      cancelled = true;
    };
  }, [authReady]);

  const contentReady = isAdminRoute || contentDataLoaded;
  const hideSiteChrome = isAdminRoute || (isChinaTripsRoute && isMiniAppViewport);

  if (!authReady) return null;
  if (!contentReady) return null;

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
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      {!hideSiteChrome && <Footer />}
    </div>
  );
}

export default App;

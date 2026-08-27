import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { useSessionStore } from './stores/sessionStore.js';
import { useUiStore } from './stores/uiStore.js';

// The catalogue is the landing page, so it is imported eagerly. Everything
// else is split per route: a signed-out visitor should not download the
// keeper desk, and nobody should download the chart library until they open
// the dashboard. Lighthouse flagged 85 KiB of unused JavaScript before this.
import Catalogue from './pages/Catalogue.jsx';

const ToolDetail = lazy(() => import('./pages/ToolDetail.jsx'));
const MyLoans    = lazy(() => import('./pages/MyLoans.jsx'));
const Desk       = lazy(() => import('./pages/Desk.jsx'));
const Dashboard  = lazy(() => import('./pages/Dashboard.jsx'));
const SignIn     = lazy(() => import('./pages/SignIn.jsx'));

/** Shown only while a route chunk is in flight - usually a single frame. */
const RouteFallback = () => (
  <div className="boot" role="status"><span className="spinner" /> Loading...</div>
);

export default function App() {
  const boot = useSessionStore((s) => s.boot);
  const initTheme = useUiStore((s) => s.initTheme);

  useEffect(() => {
    boot();
    return initTheme();      // returns the media-query unsubscribe
  }, [boot, initTheme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* public */}
          <Route path="/" element={<Catalogue />} />
          <Route path="/tools/:id" element={<Suspense fallback={<RouteFallback />}><ToolDetail /></Suspense>} />
          <Route path="/signin" element={<Suspense fallback={<RouteFallback />}><SignIn /></Suspense>} />

          {/* any signed-in member */}
          <Route element={<RequireAuth />}>
            <Route path="/loans" element={<Suspense fallback={<RouteFallback />}><MyLoans /></Suspense>} />
          </Route>

          {/* keepers only */}
          <Route element={<RequireAuth role="keeper" />}>
            <Route path="/desk" element={<Suspense fallback={<RouteFallback />}><Desk /></Suspense>} />
            <Route path="/dashboard" element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

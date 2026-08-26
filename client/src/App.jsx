import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { useSessionStore } from './stores/sessionStore.js';
import { useUiStore } from './stores/uiStore.js';
import Catalogue from './pages/Catalogue.jsx';
import ToolDetail from './pages/ToolDetail.jsx';
import MyLoans from './pages/MyLoans.jsx';
import Desk from './pages/Desk.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SignIn from './pages/SignIn.jsx';

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
          <Route path="/tools/:id" element={<ToolDetail />} />
          <Route path="/signin" element={<SignIn />} />

          {/* any signed-in member */}
          <Route element={<RequireAuth />}>
            <Route path="/loans" element={<MyLoans />} />
          </Route>

          {/* keepers only */}
          <Route element={<RequireAuth role="keeper" />}>
            <Route path="/desk" element={<Desk />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

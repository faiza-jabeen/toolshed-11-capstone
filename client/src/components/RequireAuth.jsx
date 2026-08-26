import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSessionStore, selectSessionStatus, selectUser } from '../stores/sessionStore.js';

/**
 * Three states, and the middle one is the bug everyone ships: while the silent
 * refresh is in flight we are neither signed in nor signed out, so redirecting
 * here would bounce a valid session to the sign-in page on every hard reload.
 *
 * This is convenience, not security — every protected endpoint checks again.
 */
export function RequireAuth({ role }) {
  const status = useSessionStore(selectSessionStatus);
  const user = useSessionStore(selectUser);
  const location = useLocation();

  if (status === 'booting') {
    return <div className="boot" role="status"><span className="spinner" /> Checking your session…</div>;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }
  if (role && user?.role !== role) {
    return <Navigate to="/" replace state={{ denied: role }} />;
  }
  return <Outlet />;
}

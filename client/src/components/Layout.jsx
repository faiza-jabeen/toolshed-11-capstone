import { Link, NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSessionStore, selectUser, selectSessionStatus, selectIsKeeper } from '../stores/sessionStore.js';
import { useUiStore } from '../stores/uiStore.js';
import { Toasts } from './Toasts.jsx';

export function Layout() {
  const user = useSessionStore(selectUser);
  const status = useSessionStore(selectSessionStatus);
  const isKeeper = useSessionStore(selectIsKeeper);
  const logout = useSessionStore((s) => s.logout);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [user]);

  const signOut = async () => { setBusy(true); try { await logout(); } finally { setBusy(false); } };

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>

      <header className="masthead">
        <div className="u-shell masthead__inner">
          <Link className="wordmark" to="/">
            <span className="wordmark__mark" aria-hidden="true">TS</span>
            <span className="wordmark__text">Kirkgate<br /><em>Toolshed</em></span>
          </Link>

          <button className="masthead__burger" type="button" aria-expanded={menuOpen}
                  aria-controls="primary-nav" onClick={() => setMenuOpen((o) => !o)}>
            <span className="masthead__bars" aria-hidden="true" />
            <span className="u-visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          </button>

          <nav className={`masthead__nav${menuOpen ? ' is-open' : ''}`} id="primary-nav" aria-label="Primary">
            <NavLink className="masthead__link" to="/" end>Catalogue</NavLink>
            {status === 'authenticated' && <NavLink className="masthead__link" to="/loans">My loans</NavLink>}
            {isKeeper && <NavLink className="masthead__link" to="/desk">Desk</NavLink>}
            {isKeeper && <NavLink className="masthead__link" to="/dashboard">Dashboard</NavLink>}

            <button className="theme" type="button" onClick={toggleTheme}
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
            </button>

            {status === 'authenticated' ? (
              <span className="masthead__me">
                <span className="masthead__who">{user.name}</span>
                <span className={`badge badge--${user.role}`}>{user.role}</span>
                <button className="btn btn--ghost btn--sm btn--on-dark" onClick={signOut} disabled={busy}>
                  {busy && <span className="spinner" />}{busy ? 'Signing out…' : 'Sign out'}
                </button>
              </span>
            ) : status === 'booting' ? (
              <span className="skeleton" style={{ width: '6rem', height: '.9rem' }} aria-hidden="true" />
            ) : (
              <Link className="btn btn--tape btn--sm" to="/signin">Sign in</Link>
            )}
          </nav>
        </div>
      </header>

      <main id="main"><Outlet /></main>

      <footer className="colophon">
        <div className="u-shell">
          <p className="colophon__mark">Kirkgate Toolshed</p>
          <p className="colophon__body">
            A volunteer-run tool library, Unit 4 The Old Bus Depot, Leeds LS2 7DJ.
            Open Tuesday and Thursday 17:00–20:00, Saturday 09:30–16:00.
          </p>
        </div>
      </footer>

      <Toasts />
    </>
  );
}

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../RequireAuth.jsx';
import { useSessionStore } from '../../stores/sessionStore.js';
import { aKeeper, aMember } from '../../test/factories.js';

const show = (role) => render(
  <MemoryRouter initialEntries={['/desk']}>
    <Routes>
      <Route path="/" element={<p>Catalogue page</p>} />
      <Route path="/signin" element={<p>Sign-in page</p>} />
      <Route element={<RequireAuth role={role} />}>
        <Route path="/desk" element={<p>Keeper desk</p>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('RequireAuth', () => {
  test('waits while the session is still booting', () => {
    useSessionStore.setState({ user: null, status: 'booting' });
    show();
    // The bug everyone ships: redirecting here bounces a valid session to
    // sign-in on every hard reload, because the refresh has not landed yet.
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
    expect(screen.queryByText(/sign-in page/i)).not.toBeInTheDocument();
  });

  test('redirects an anonymous visitor to sign in', () => {
    useSessionStore.setState({ user: null, status: 'anonymous' });
    show();
    expect(screen.getByText(/sign-in page/i)).toBeInTheDocument();
  });

  test('lets a signed-in user through when no role is required', () => {
    useSessionStore.setState({ user: aMember(), status: 'authenticated' });
    show();
    expect(screen.getByText(/keeper desk/i)).toBeInTheDocument();
  });

  test('bounces a member away from a keeper-only route', () => {
    useSessionStore.setState({ user: aMember(), status: 'authenticated' });
    show('keeper');
    expect(screen.getByText(/catalogue page/i)).toBeInTheDocument();
    expect(screen.queryByText(/keeper desk/i)).not.toBeInTheDocument();
  });

  test('lets a keeper into a keeper-only route', () => {
    useSessionStore.setState({ user: aKeeper(), status: 'authenticated' });
    show('keeper');
    expect(screen.getByText(/keeper desk/i)).toBeInTheDocument();
  });
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ToolDetail from '../../pages/ToolDetail.jsx';
import { useSessionStore } from '../../stores/sessionStore.js';
import { useLoanStore } from '../../stores/loanStore.js';
import { aTool, aMember } from '../../test/factories.js';

const show = (id = 1) => render(
  <MemoryRouter initialEntries={[`/tools/${id}`]}>
    <Routes><Route path="/tools/:id" element={<ToolDetail />} /></Routes>
  </MemoryRouter>,
);

const serve = (tool) => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true, status: 200, json: async () => ({ data: tool }),
  }));
};

const signIn = (user) => useSessionStore.setState({ user, status: 'authenticated' });

beforeEach(() => { useSessionStore.setState({ user: null, status: 'anonymous' }); });

describe('ToolDetail — borrowing', () => {
  test('a signed-out visitor is asked to sign in, not shown the form', async () => {
    serve(aTool({ status: 'in' }));
    show();
    expect(await screen.findByRole('link', { name: /sign in to borrow/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /borrow/i })).not.toBeInTheDocument();
  });

  test('a signed-in member gets the borrow form with the deposit on the button', async () => {
    signIn(aMember());
    serve(aTool({ status: 'in', deposit: 25 }));
    show();
    expect(await screen.findByRole('button', { name: /borrow — £25 deposit/i })).toBeInTheDocument();
  });

  test('a tool that is out explains when it is back instead of offering it', async () => {
    signIn(aMember());
    serve(aTool({ status: 'out', currentLoan: { dueOn: '2026-09-04', overdue: false } }));
    show();
    expect(await screen.findByText(/not available right now/i)).toBeInTheDocument();
    expect(screen.getByText(/until 2026-09-04/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /borrow/i })).not.toBeInTheDocument();
  });

  test('a tool in repair says so, rather than saying it is lent out', async () => {
    signIn(aMember());
    serve(aTool({ status: 'repair' }));
    show();
    expect(await screen.findByText(/in for repair/i)).toBeInTheDocument();
  });

  test('submitting calls borrow with the chosen date', async () => {
    signIn(aMember());
    const tool = aTool({ id: 7, status: 'in' });
    serve(tool);
    const borrow = vi.fn().mockResolvedValue({ ok: true, loan: { id: 1 } });
    useLoanStore.setState({ borrow });

    show(7);
    await userEvent.click(await screen.findByRole('button', { name: /borrow/i }));

    expect(borrow).toHaveBeenCalledTimes(1);
    expect(borrow.mock.calls[0][0].id).toBe(7);
    expect(borrow.mock.calls[0][1]).toHaveProperty('dueOn');
  });

  test('a server field error is shown against the date input', async () => {
    signIn(aMember());
    serve(aTool({ status: 'in' }));
    useLoanStore.setState({
      borrow: vi.fn().mockResolvedValue({ ok: false, fields: { dueOn: 'Loans run to 7 days — that would be longer.' } }),
    });

    show();
    await userEvent.click(await screen.findByRole('button', { name: /borrow/i }));
    expect(await screen.findByText(/loans run to 7 days/i)).toBeInTheDocument();
  });

  test('a failed load shows an error and a way back, not a blank page', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 404, json: async () => ({ error: { message: 'Tool not found.' } }),
    }));
    show(999);
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to the catalogue/i })).toBeInTheDocument();
  });
});

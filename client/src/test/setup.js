import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { useCatalogueStore } from '../stores/catalogueStore.js';
import { useSessionStore } from '../stores/sessionStore.js';
import { useLoanStore } from '../stores/loanStore.js';
import { useUiStore } from '../stores/uiStore.js';

/**
 * Zustand stores are module singletons, so without this every test inherits
 * whatever the previous one left behind — tests that pass alone and fail in a
 * suite. Snapshot at import, restore before each.
 */
const initial = {
  catalogue: useCatalogueStore.getState(),
  session: useSessionStore.getState(),
  loans: useLoanStore.getState(),
  ui: useUiStore.getState(),
};

beforeEach(() => {
  useCatalogueStore.setState(initial.catalogue, true);
  useSessionStore.setState(initial.session, true);
  useLoanStore.setState(initial.loans, true);
  useUiStore.setState(initial.ui, true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom implements neither of these, and both are touched on boot.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  });
}

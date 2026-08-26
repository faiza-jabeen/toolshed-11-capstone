import { describe, test, expect, beforeEach, vi } from 'vitest';
import { applyTheme, resolveTheme, storedTheme } from '../../lib/theme.js';

const setSystem = (dark) => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: dark, addEventListener() {}, removeEventListener() {},
  });
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
});

describe('theme resolution', () => {
  test('follows the OS when the user has never chosen', () => {
    setSystem(true);
    expect(resolveTheme()).toBe('dark');
    setSystem(false);
    expect(resolveTheme()).toBe('light');
  });

  test('an explicit choice beats the OS setting', () => {
    setSystem(true);
    applyTheme('light');
    expect(storedTheme()).toBe('light');
    expect(resolveTheme()).toBe('light');
  });

  test('applying a theme sets the attribute the CSS keys off', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  test('the browser chrome colour follows the theme', () => {
    applyTheme('dark');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#0C1A15');
    applyTheme('light');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#14332A');
  });

  test('survives localStorage being unavailable', () => {
    // Safari private mode throws on setItem; the app must not die for that.
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => applyTheme('dark')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('dark');
    Storage.prototype.setItem = original;
  });
});

/*
 * Appearance control.
 *
 * Deliberately defaults to LIGHT rather than following the OS: dark mode is hard to
 * read for a lot of people, and silently inheriting a dark system setting takes that
 * choice away from them. Following the system is available, but it has to be chosen.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'appearance';
const media = () => matchMedia('(prefers-color-scheme: dark)');

export function readChoice(): ThemeChoice {
  const stored = localStorage.getItem(KEY);
  return stored === 'dark' || stored === 'system' ? stored : 'light';
}

/** Resolves 'system' to the OS preference; everything else is taken literally. */
export function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') return media().matches ? 'dark' : 'light';
  return choice;
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolve(choice);
}

export function setTheme(choice: ThemeChoice) {
  localStorage.setItem(KEY, choice);
  applyTheme(choice);
}

/**
 * Call once at startup, before first paint, so the initial render is already correct
 * and the colour transition doesn't animate on load.
 */
export function initTheme() {
  applyTheme(readChoice());
  // Only track the OS while the user has actually asked us to follow it.
  media().addEventListener('change', () => {
    if (readChoice() === 'system') applyTheme('system');
  });
  requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'));
}

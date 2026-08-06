import { lazy, type ComponentType } from 'react';

const RELOADED_KEY = 'chunk-reload-at';

/**
 * `React.lazy` that survives a deployment.
 *
 * Every build gives its chunks new hashed filenames and deletes the old ones. Anyone with the
 * app already open is holding the previous `index.html`, so their next navigation asks for a
 * file that no longer exists — the import rejects and React renders nothing. A blank screen,
 * for no reason the user did anything about.
 *
 * The browser only needs a fresh `index.html`, so reload once and the new chunk names arrive.
 * Guarded by a timestamp: if a reload does not fix it, the failure is real (offline, a broken
 * deploy) and looping would be worse than showing the error.
 */
// `any` mirrors React.lazy's own constraint — pages take different props, and narrowing it
// here would reject every page that has any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy<T>(() =>
    load().catch((error: unknown): Promise<{ default: T }> => {
      const lastReload = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
      const recentlyReloaded = Date.now() - lastReload < 15_000;
      if (recentlyReloaded) throw error;
      sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
      window.location.reload();
      // Never resolves; the reload replaces the page before React can render anything.
      return new Promise<{ default: T }>(() => {});
    }),
  );
}

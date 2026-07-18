/**
 * Which "site" is this?
 *
 *  - The apex host (yoobus.com, or localhost in dev) is the CUSTOMER site: search & book tickets.
 *  - The `app.` host (app.yoobus.com, or app.localhost in dev) is the STAFF console:
 *    SuperAdmin, Operator Admin, and all operator staff.
 *
 * `app.localhost` resolves to 127.0.0.1 in every modern browser, so the same split works locally.
 * `VITE_FORCE_APP=true` forces the app site (handy when testing on a plain localhost).
 */
export function isAppHost(): boolean {
  if (import.meta.env.VITE_FORCE_APP === 'true') return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'app.localhost' || host.startsWith('app.');
}

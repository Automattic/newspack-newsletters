/**
 * Safe getters for the PHP-localised `newspackNewslettersAdmin` global.
 *
 * Importing modules can run outside wp-admin (Jest, Storybook, a
 * misconfigured enqueue), so reaching into `window.newspackNewslettersAdmin`
 * directly throws when the global is absent. These getters use optional
 * chaining + sensible fallbacks so the modules stay importable.
 *
 * The values are PHP-side mirrors; if they ever drift from the real
 * registration, the fallbacks here are a safety net rather than a
 * source of truth — see `Admin_Shell::enqueue_assets`.
 */

const DEFAULT_ADMIN_URL = '/wp-admin/';
const DEFAULT_CPT_SLUG = 'newspack_nl_cpt';

function getGlobal() {
	return typeof window === 'undefined' ? null : window.newspackNewslettersAdmin || null;
}

/**
 * Resolve the admin base URL (always trailing-slashed, e.g. `/wp-admin/`).
 *
 * @return {string} Trailing-slashed URL.
 */
export function getAdminUrl() {
	return getGlobal()?.adminUrl || DEFAULT_ADMIN_URL;
}

/**
 * Resolve the Newsletters CPT slug.
 *
 * @return {string} CPT slug.
 */
export function getCptSlug() {
	return getGlobal()?.cptSlug || DEFAULT_CPT_SLUG;
}

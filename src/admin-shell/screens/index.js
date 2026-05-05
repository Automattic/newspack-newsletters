/**
 * Screen registry for the admin shell.
 *
 * Each entry maps an admin page slug (matching the PHP-side slug)
 * to a React component plus its menu label. Slugs that aren't
 * registered here resolve to null. Settings is standalone-only at
 * the PHP layer — `Admin_Shell::get_pages()` skips registering it
 * in bundled mode.
 */

import { __ } from '@wordpress/i18n';
import NewslettersListScreen from './newsletters-list';
import AdsListScreen from './ads-list';
import AdvertisersListScreen from './advertisers-list';
import LayoutsListScreen from './layouts-list';
import SettingsScreen from './settings';

export const screens = {
	'newspack-newsletters-list': {
		component: NewslettersListScreen,
		label: __( 'All Newsletters', 'newspack-newsletters' ),
	},
	'newspack-newsletters-ads-list': {
		component: AdsListScreen,
		label: __( 'Newsletter Ads', 'newspack-newsletters' ),
	},
	'newspack-newsletters-advertisers-list': {
		component: AdvertisersListScreen,
		label: __( 'Advertisers', 'newspack-newsletters' ),
	},
	'newspack-newsletters-layouts-list': {
		component: LayoutsListScreen,
		label: __( 'Layouts', 'newspack-newsletters' ),
	},
	'newspack-newsletters-settings': {
		component: SettingsScreen,
		label: __( 'Settings', 'newspack-newsletters' ),
	},
};

export function resolveScreen( slug ) {
	if ( ! slug ) {
		return null;
	}
	return screens[ slug ] || null;
}

/**
 * Resolve the visible page label, preferring the PHP-localised value
 * (`window.newspackNewslettersAdmin.label`) so the heading/title stays
 * aligned with the admin menu label PHP renders. Falls back to the JS
 * registry entry's label when the global is missing — e.g. in unit
 * tests, Storybook, or a misconfigured enqueue.
 *
 * @param {string} slug          Page slug (PHP-localised `currentPage`).
 * @param {Object} [globalScope] Override for tests; defaults to `window`.
 * @return {string} Resolved label, or an empty string if neither source has one.
 */
export function resolveLabel( slug, globalScope = typeof window === 'undefined' ? {} : window ) {
	const phpLabel = globalScope?.newspackNewslettersAdmin?.label;
	if ( phpLabel ) {
		return phpLabel;
	}
	return resolveScreen( slug )?.label || '';
}

/**
 * Screen registry for the admin shell.
 *
 * Each entry maps an admin page slug (matching the PHP-side slug)
 * to a React component plus its menu label. Slugs that aren't
 * registered here resolve to null.
 *
 * Currently registered:
 *  - newspack-newsletters-list (NEWS-1928): the React DataView replacing
 *    the classic CPT list.
 *  - newspack-newsletters-settings (NEWS-1927 placeholder, becomes the
 *    real React surface in NEWS-1931). Standalone-only at the PHP layer.
 */

import { __ } from '@wordpress/i18n';
import Placeholder from './placeholder';
import NewslettersListScreen from './newsletters-list';

export const screens = {
	'newspack-newsletters-list': {
		component: NewslettersListScreen,
		label: __( 'All Newsletters', 'newspack-newsletters' ),
	},
	'newspack-newsletters-settings': {
		component: Placeholder,
		label: __( 'Settings', 'newspack-newsletters' ),
	},
};

export function resolveScreen( slug ) {
	if ( ! slug ) {
		return null;
	}
	return screens[ slug ] || null;
}

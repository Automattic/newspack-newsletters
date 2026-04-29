/**
 * Screen registry for the admin shell.
 *
 * Each entry maps an admin page slug (matching the PHP-side slug)
 * to a React component plus its menu label. Slugs that aren't
 * registered here resolve to null.
 */

import { __ } from '@wordpress/i18n';
import Placeholder from './placeholder';

export const screens = {
	'newspack-newsletters': {
		component: Placeholder,
		label: __( 'Newsletters', 'newspack-newsletters' ),
	},
	'newspack-newsletters-layouts': {
		component: Placeholder,
		label: __( 'Layouts', 'newspack-newsletters' ),
	},
	'newspack-newsletters-ads': {
		component: Placeholder,
		label: __( 'Ads', 'newspack-newsletters' ),
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

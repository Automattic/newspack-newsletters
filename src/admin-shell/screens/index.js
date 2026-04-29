/**
 * Screen registry for the admin shell.
 *
 * Each entry maps an admin page slug (matching the PHP-side slug)
 * to a React component plus its menu label. Slugs that aren't
 * registered here resolve to null.
 *
 * NEWS-1928 to NEWS-1931 each register their own screen as they
 * land. NEWS-1927 ships with Settings only — the only React surface
 * the chassis introduces today.
 */

import { __ } from '@wordpress/i18n';
import Placeholder from './placeholder';

export const screens = {
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

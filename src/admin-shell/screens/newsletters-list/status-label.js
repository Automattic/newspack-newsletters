/**
 * Map the consolidated `kind` value from the `newspack_newsletters_status`
 * REST field to a translated user-facing label.
 *
 * Keep in sync with the `enum` in `Newsletters_List_REST::register_rest_fields`.
 */

import { __ } from '@wordpress/i18n';

// Lazy-memoised module-level cache. Building the map runs `__()` once
// per key, and the function is called per row during DataView rendering
// — without caching, every row re-allocates the object and re-runs the
// translation lookups. We populate on first call (rather than at module
// load) so i18n data has time to register.
let cachedLabels = null;

export function STATUS_KIND_LABELS() {
	if ( null === cachedLabels ) {
		cachedLabels = {
			sent: __( 'Sent', 'newspack-newsletters' ),
			scheduled: __( 'Scheduled', 'newspack-newsletters' ),
			draft: __( 'Draft', 'newspack-newsletters' ),
			trash: __( 'Trash', 'newspack-newsletters' ),
		};
	}
	return cachedLabels;
}

export function statusKindLabel( kind ) {
	const labels = STATUS_KIND_LABELS();
	return labels[ kind ] || labels.draft;
}

/**
 * Returns true if a row item is currently in the trash. The DataViews
 * actions read this to gate destructive vs restorative buttons.
 *
 * @param {Object} item Post object from REST.
 * @return {boolean} True when the row is trashed.
 */
export function isTrashed( item ) {
	return 'trash' === item?.status;
}

/**
 * URL-driven initial view state for the Layouts list.
 *
 * The Layouts page has no legacy admin URL to redirect from (the
 * layouts CPT is `'public' => false` and never surfaced its own
 * `edit.php?post_type=…` admin screen). Even so, expose the same
 * shape the Advertisers / Ads / Newsletters lists do so deep links
 * the chassis may forward in future continue to work, and so
 * URL-shareable filter / sort state is supported day-one.
 */

const ORDERBY_TO_SORT_FIELD = {
	title: 'title',
	modified: 'modified',
	date: 'date',
};

/**
 * Read the document URL and return a partial DataView `view` patch
 * (search / sort) seeded from the query string. Anything not present
 * is omitted so the caller can spread the result over its
 * `DEFAULT_VIEW` without clobbering keys.
 *
 * @param {string} [search] URL search string (defaults to `window.location.search`).
 * @return {Object} Partial view object.
 */
export function getInitialView( search = typeof window === 'undefined' ? '' : window.location.search ) {
	const params = new URLSearchParams( search );
	const patch = {};

	const term = params.get( 's' );
	if ( term ) {
		patch.search = term;
	}

	const orderby = params.get( 'orderby' );
	const order = params.get( 'order' );
	const sortField = orderby && ORDERBY_TO_SORT_FIELD[ orderby ];
	if ( sortField ) {
		patch.sort = {
			field: sortField,
			direction: 'asc' === ( order || '' ).toLowerCase() ? 'asc' : 'desc',
		};
	}

	return patch;
}

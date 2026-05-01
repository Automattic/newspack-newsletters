/**
 * URL-driven initial view state for the Advertisers list DataView.
 *
 * `Admin_Shell::maybe_redirect_legacy_list` forwards a curated set of
 * query args from the legacy `edit-tags.php?taxonomy=newspack_nl_advertiser`
 * URL onto the React page (search term, sort field, sort direction).
 * Translate those raw values into DataViews-shaped state so a deep link
 * like `…&s=acme&orderby=slug` lands on the matching filtered + sorted
 * list rather than the unfiltered default.
 *
 * Pure module so it stays trivial to unit-test.
 */

// Map the WP REST terms controller `orderby` values that the React
// DataView fields here also expose. `id` / `include` / `term_group`
// are accepted by REST but the DataView has no field for them, so a
// legacy URL using those values falls through to the default sort
// rather than producing an invalid state.
const ORDERBY_TO_SORT_FIELD = {
	name: 'name',
	slug: 'slug',
	count: 'count',
};

/**
 * Read the current document URL and return a partial DataView `view`
 * patch (search / sort) seeded from forwarded legacy args. Anything
 * not present in the URL is omitted so callers can spread the result
 * over their `DEFAULT_VIEW` without clobbering keys.
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
			direction: 'desc' === ( order || '' ).toLowerCase() ? 'desc' : 'asc',
		};
	}

	return patch;
}

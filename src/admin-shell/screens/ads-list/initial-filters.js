/**
 * URL-driven initial view state for the Ads list DataView.
 *
 * `Admin_Shell::maybe_redirect_legacy_list` forwards a curated set of
 * query args from the legacy `edit.php?post_type=newspack_nl_ads_cpt`
 * URL onto the React page (status filter, search term, sort field,
 * sort direction). Translate those raw values into DataViews-shaped
 * state.
 *
 * Pure module so it stays trivial to unit-test.
 */

// Map legacy post_status values onto a kind-based filter value. The
// classic ads list only meaningfully exposes draft / trash via this
// query arg; "publish" rows split across active / scheduled / expired
// kinds, so we don't translate that case (the React default already
// shows them).
const POST_STATUS_TO_KIND = {
	trash: 'trash',
	draft: 'draft',
	pending: 'draft',
};

// Inverse of `SORT_FIELD_TO_ORDERBY` in build-query: map legacy ads
// `orderby` values back onto the DataView field id.
const ORDERBY_TO_SORT_FIELD = {
	title: 'title',
	date: 'date',
	start_date: 'start_date',
	expiry_date: 'expiry_date',
	price: 'price',
	impressions: 'impressions',
	clicks: 'clicks',
};

/**
 * Read the current document URL and return DataViews-compatible
 * filters seeded from `post_status`. Returns `[]` when no recognised
 * value is present.
 *
 * @param {string} [search] URL search string (defaults to `window.location.search`).
 * @return {Array<{ field: string, operator: string, value: Array<string> }>} DataViews-shaped initial filters.
 */
export function getInitialFilters( search = typeof window === 'undefined' ? '' : window.location.search ) {
	const params = new URLSearchParams( search );
	const postStatus = params.get( 'post_status' );
	if ( ! postStatus ) {
		return [];
	}

	const kind = POST_STATUS_TO_KIND[ postStatus ];
	if ( ! kind ) {
		return [];
	}

	return [ { field: 'status', operator: 'isAny', value: [ kind ] } ];
}

/**
 * Read the current document URL and return a partial DataView `view`
 * patch (filters / search / sort) seeded from forwarded legacy args.
 * Anything not present in the URL is omitted so callers can spread
 * the result over their `DEFAULT_VIEW` without clobbering keys.
 *
 * @param {string} [search] URL search string (defaults to `window.location.search`).
 * @return {Object} Partial view object.
 */
export function getInitialView( search = typeof window === 'undefined' ? '' : window.location.search ) {
	const params = new URLSearchParams( search );
	const patch = {};

	const filters = getInitialFilters( search );
	if ( filters.length > 0 ) {
		patch.filters = filters;
	}

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

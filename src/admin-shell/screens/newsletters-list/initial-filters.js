/**
 * URL-driven initial view state for the Newsletters list DataView.
 *
 * `Admin_Shell::maybe_redirect_legacy_list` forwards a curated set of
 * query args from the legacy `edit.php?post_type=newspack_nl_cpt` URL
 * onto the React page (status filter, search term, sort field, sort
 * direction). Translate those raw values into DataViews-shaped state.
 *
 * Pure module so it stays trivial to unit-test.
 */

const POST_STATUS_TO_FILTER_VALUE = {
	trash: 'trash',
	draft: 'draft,pending,auto-draft',
	pending: 'draft,pending,auto-draft',
	'auto-draft': 'draft,pending,auto-draft',
	future: 'future',
	publish: 'publish,private',
	private: 'publish,private',
};

// Inverse of the JS-side `SORT_FIELD_TO_ORDERBY` in build-query: map
// REST `orderby` values back onto the DataView field id our `getFields`
// configuration uses.
const ORDERBY_TO_SORT_FIELD = {
	title: 'title',
	date: 'date',
	author: 'author',
};

// URL param → DataView filter field; mirrors build-query's reverse mapping.
const URL_PARAM_TO_FILTER_FIELD = {
	author: 'author',
	categories: 'categories',
	tags: 'tags',
	newspack_newsletters_send_list_id: 'send_list',
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
	const filters = [];

	const postStatus = params.get( 'post_status' );
	if ( postStatus ) {
		const value = POST_STATUS_TO_FILTER_VALUE[ postStatus ];
		if ( value ) {
			filters.push( { field: 'status', operator: 'isAny', value: [ value ] } );
		}
	}

	for ( const [ urlParam, fieldId ] of Object.entries( URL_PARAM_TO_FILTER_FIELD ) ) {
		const raw = params.get( urlParam );
		if ( ! raw ) {
			continue;
		}
		const values = raw
			.split( ',' )
			.map( v => v.trim() )
			.filter( Boolean );
		if ( values.length > 0 ) {
			filters.push( { field: fieldId, operator: 'isAny', value: values } );
		}
	}

	return filters;
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

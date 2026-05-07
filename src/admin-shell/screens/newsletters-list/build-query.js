/**
 * Translate a DataViews `view` object into the query string used by
 * `/wp/v2/newspack_nl_cpt`. Pure function so it's trivial to test.
 *
 * View shape (subset we care about):
 *   { page, perPage, sort?: { field, direction }, search?, filters?: [{ field, operator, value }] }
 *
 * Notes on filtering:
 * - We map filters to native WP REST params (`status`, `author`) rather
 *   than to our derived `kind` so server-side queries stay simple. The
 *   Status column still renders the derived `kind` (sent/scheduled/draft/
 *   trash) for visual clarity — see `renderStatus` in `fields.js`.
 * - `status=any` excludes trash by default, so we explicitly include the
 *   common writable statuses when no status filter is set.
 */

// `auto-draft` so an abandoned "Add new" still shows in the list.
const DEFAULT_STATUSES = [ 'publish', 'private', 'future', 'draft', 'pending', 'auto-draft' ];

const FIELD_TO_QUERY_PARAM = {
	status: 'status',
	author: 'author',
	// `public_page` filter values are `'1'` / `'0'` (see `getFields`).
	// `Newsletters_List_REST::filter_rest_query` consumes the same param.
	public_page: 'newspack_newsletters_is_public',
};

const SORT_FIELD_TO_ORDERBY = {
	title: 'title',
	date: 'date',
	send_date: 'date',
	author: 'author',
};

function asArray( value ) {
	if ( Array.isArray( value ) ) {
		return value;
	}
	if ( value === undefined || value === null || value === '' ) {
		return [];
	}
	return [ value ];
}

export function buildQueryParams( view = {} ) {
	const params = {
		page: view.page || 1,
		per_page: view.perPage || 25,
		_embed: 'author,wp:term',
		context: 'edit',
	};

	if ( view.search ) {
		params.search = view.search;
	}

	if ( view.sort?.field && SORT_FIELD_TO_ORDERBY[ view.sort.field ] ) {
		params.orderby = SORT_FIELD_TO_ORDERBY[ view.sort.field ];
		params.order = view.sort.direction === 'asc' ? 'asc' : 'desc';
	}

	const filters = Array.isArray( view.filters ) ? view.filters : [];
	const statusFilter = filters.find( filter => filter.field === 'status' );

	if ( statusFilter ) {
		params.status = asArray( statusFilter.value ).join( ',' );
	} else {
		params.status = DEFAULT_STATUSES.join( ',' );
	}

	for ( const filter of filters ) {
		if ( filter.field === 'status' ) {
			continue;
		}
		const param = FIELD_TO_QUERY_PARAM[ filter.field ];
		if ( ! param ) {
			continue;
		}
		const values = asArray( filter.value );
		if ( values.length === 0 ) {
			continue;
		}
		params[ param ] = values.join( ',' );
	}

	return params;
}

/**
 * Serialise params object into a query string suitable for apiFetch's `path`.
 *
 * @param {Object} params Query params from buildQueryParams.
 * @return {string} Query string starting with `?`.
 */
export function toQueryString( params ) {
	const search = new URLSearchParams();
	Object.entries( params ).forEach( ( [ key, value ] ) => {
		if ( value === undefined || value === null || value === '' ) {
			return;
		}
		search.append( key, String( value ) );
	} );
	return `?${ search.toString() }`;
}

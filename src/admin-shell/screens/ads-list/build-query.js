/**
 * Translate a DataViews `view` object into the query string used by
 * `/wp/v2/newspack_nl_ads_cpt`.
 *
 * Notes on filtering:
 * - The status filter passes kind values (`active|scheduled|expired|draft|trash`)
 *   through the custom REST query param `newspack_newsletters_ad_status`. The
 *   server (`Ads_List_REST::filter_rest_query`) turns each kind into the
 *   corresponding `post_status` set + a date-driven SQL bucket. The Status
 *   column renders the same kinds, so the displayed and filtered sets always
 *   match exactly.
 * - When no kind filter is set, we hand the request a wide `post_status`
 *   default (every writable status except trash) so the React list shows the
 *   same set the publisher previously saw on the classic CPT list.
 */

const DEFAULT_STATUSES = [ 'publish', 'private', 'draft', 'pending' ];

// Each value is the WP REST taxonomy filter param — i.e. the
// taxonomy's `rest_base`, which defaults to the taxonomy slug when
// not explicitly set. Advertiser has no override (param matches the
// slug); Ad placement is registered with `rest_base => 'ad_placement'`
// (see `class-ads-placements.php`), so the filter param is the short
// form, not the taxonomy slug.
const FIELD_TO_QUERY_PARAM = {
	advertiser: 'newspack_nl_advertiser',
	ad_placement: 'ad_placement',
};

const SORT_FIELD_TO_ORDERBY = {
	title: 'title',
	date: 'date',
	start_date: 'meta_value',
	expiry_date: 'meta_value',
	price: 'meta_value_num',
	impressions: 'meta_value_num',
	clicks: 'meta_value_num',
};

const SORT_FIELD_TO_META_KEY = {
	start_date: 'start_date',
	expiry_date: 'expiry_date',
	price: 'price',
	impressions: 'tracking_impressions',
	clicks: 'tracking_clicks',
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
		_embed: 'wp:term',
		context: 'edit',
	};

	if ( view.search ) {
		params.search = view.search;
	}

	if ( view.sort?.field && SORT_FIELD_TO_ORDERBY[ view.sort.field ] ) {
		params.orderby = SORT_FIELD_TO_ORDERBY[ view.sort.field ];
		params.order = view.sort.direction === 'asc' ? 'asc' : 'desc';
		const metaKey = SORT_FIELD_TO_META_KEY[ view.sort.field ];
		if ( metaKey ) {
			params.meta_key = metaKey;
		}
	}

	const filters = Array.isArray( view.filters ) ? view.filters : [];
	const statusFilter = filters.find( filter => filter.field === 'status' );

	if ( statusFilter ) {
		const kinds = asArray( statusFilter.value );
		if ( kinds.length > 0 ) {
			params.newspack_newsletters_ad_status = kinds.join( ',' );
		}
	} else {
		// No kind filter: hand WP a post_status default that matches the
		// writable statuses publishers see today on the classic list.
		// Trash is excluded by default — selecting Trash in the filter
		// flips into the kind path which sets `post_status=trash`
		// server-side.
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

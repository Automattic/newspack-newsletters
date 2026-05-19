/**
 * Shared factory for translating forwarded legacy admin URL args into
 * DataViews `view` patches (filters / search / sort).
 *
 * Each list screen receives forwarded query args from
 * `Admin_Shell::maybe_redirect_legacy_list` and seeds its initial view
 * from them. The translation shape is uniform: a `post_status` →
 * filter-value map, an `orderby` → DataView field map, and optional
 * extra URL-param → filter-field bindings. The factory captures that
 * shape so each screen contributes only its lookup tables.
 */

const EMPTY_SEARCH = '';

const readSearch = search => search ?? ( typeof window === 'undefined' ? EMPTY_SEARCH : window.location.search );

/**
 * Build a `{ getInitialFilters, getInitialView }` pair for a list screen.
 *
 * `defaultSortDirection` controls fallback direction when the URL has an
 * `orderby` without an `order` (or with an unrecognised one). Advertisers
 * use `'asc'` because alphabetical defaults to ascending; everywhere else
 * the default is `'desc'`.
 *
 * @param {Object} config                         Screen configuration.
 * @param {Object} config.orderbyMap              Map of REST `orderby` values to DataView field IDs.
 * @param {Object} [config.postStatusMap]         Map of `post_status` values to status-filter values.
 * @param {Object} [config.urlParamToFilterField] Map of URL params to DataView filter field IDs.
 * @param {string} [config.statusFilterField]     DataView field ID for the status filter. Defaults to `'status'`.
 * @param {string} [config.defaultSortDirection]  `'asc'` or `'desc'`. Defaults to `'desc'`.
 * @return {{ getInitialFilters: ( search?: string ) => Array, getInitialView: ( search?: string ) => Object }} URL-driven view accessors.
 */
export function makeGetInitialView( {
	orderbyMap = {},
	postStatusMap = null,
	urlParamToFilterField = null,
	statusFilterField = 'status',
	defaultSortDirection = 'desc',
} = {} ) {
	const defaultIsAsc = 'asc' === defaultSortDirection;

	function getInitialFilters( search ) {
		const params = new URLSearchParams( readSearch( search ) );
		const filters = [];

		if ( postStatusMap ) {
			const postStatus = params.get( 'post_status' );
			if ( postStatus ) {
				const value = postStatusMap[ postStatus ];
				if ( value ) {
					filters.push( { field: statusFilterField, operator: 'isAny', value: [ value ] } );
				}
			}
		}

		if ( urlParamToFilterField ) {
			for ( const [ urlParam, fieldId ] of Object.entries( urlParamToFilterField ) ) {
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
		}

		return filters;
	}

	function getInitialView( search ) {
		const resolved = readSearch( search );
		const params = new URLSearchParams( resolved );
		const patch = {};

		const filters = getInitialFilters( resolved );
		if ( filters.length > 0 ) {
			patch.filters = filters;
		}

		const term = params.get( 's' );
		if ( term ) {
			patch.search = term;
		}

		const orderby = params.get( 'orderby' );
		const sortField = orderby && orderbyMap[ orderby ];
		if ( sortField ) {
			const order = ( params.get( 'order' ) || '' ).toLowerCase();
			let direction;
			if ( defaultIsAsc ) {
				direction = 'desc' === order ? 'desc' : 'asc';
			} else {
				direction = 'asc' === order ? 'asc' : 'desc';
			}
			patch.sort = { field: sortField, direction };
		}

		return patch;
	}

	return { getInitialFilters, getInitialView };
}

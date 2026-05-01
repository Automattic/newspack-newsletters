/**
 * Server-side paginated data hook for the Advertisers list DataView.
 *
 * Wraps `apiFetch` against `/wp/v2/newspack_nl_advertiser`, reads
 * `X-WP-Total` / `X-WP-TotalPages` from the response headers, and
 * exposes a `refresh()` for the modal/action handlers to re-pull
 * after a mutation.
 *
 * Mirrors the ads list `use-ads-data` shape — kept screen-local rather
 * than promoted to a shared hook because the search-arg shapes diverge
 * across surfaces and the savings would be trivial.
 */

import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

const TAXONOMY_PATH = '/wp/v2/newspack_nl_advertiser';

function parseHeaderInt( value ) {
	const parsed = parseInt( value, 10 );
	return Number.isNaN( parsed ) ? 0 : parsed;
}

function readPaginationInfo( response ) {
	return {
		totalItems: parseHeaderInt( response.headers.get( 'X-WP-Total' ) ),
		totalPages: parseHeaderInt( response.headers.get( 'X-WP-TotalPages' ) ),
	};
}

function buildPath( view ) {
	const params = new URLSearchParams();
	params.set( 'page', String( view.page || 1 ) );
	params.set( 'per_page', String( view.perPage || 25 ) );
	params.set( 'context', 'edit' );
	if ( view.search ) {
		params.set( 'search', view.search );
	}
	if ( view.sort?.field ) {
		params.set( 'orderby', view.sort.field );
		params.set( 'order', view.sort.direction === 'asc' ? 'asc' : 'desc' );
	}
	return `${ TAXONOMY_PATH }?${ params.toString() }`;
}

/**
 * @param {Object} view DataViews view state.
 * @return {{ data: Array, paginationInfo: Object, isLoading: boolean, hasLoadedOnce: boolean, refresh: Function }} The current data, pagination info, loading flags, and a refresh handle.
 */
export default function useAdvertisersData( view ) {
	const [ data, setData ] = useState( [] );
	const [ paginationInfo, setPaginationInfo ] = useState( { totalItems: 0, totalPages: 0 } );
	const [ isLoading, setIsLoading ] = useState( true );
	// Track whether at least one fetch has resolved so the empty state
	// doesn't flash before data arrives. The DataViews' own `isLoading`
	// is not enough — `data` is `[]` and `totalItems` is `0` until the
	// first response lands, which would render the empty state during
	// the initial fetch.
	const [ hasLoadedOnce, setHasLoadedOnce ] = useState( false );
	const [ refreshKey, setRefreshKey ] = useState( 0 );

	const refresh = useCallback( () => setRefreshKey( key => key + 1 ), [] );

	useEffect( () => {
		let cancelled = false;
		setIsLoading( true );

		apiFetch( { path: buildPath( view ), parse: false } )
			.then( async response => {
				const items = await response.json();
				if ( cancelled ) {
					return;
				}
				setData( Array.isArray( items ) ? items : [] );
				setPaginationInfo( readPaginationInfo( response ) );
			} )
			.catch( () => {
				if ( cancelled ) {
					return;
				}
				setData( [] );
				setPaginationInfo( { totalItems: 0, totalPages: 0 } );
				dispatch( noticesStore ).createErrorNotice( __( 'Failed to load advertisers. Please refresh the page.', 'newspack-newsletters' ), {
					id: 'newspack-newsletters-advertisers-list-fetch-error',
				} );
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoading( false );
					setHasLoadedOnce( true );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ view.page, view.perPage, view.search, view.sort?.field, view.sort?.direction, refreshKey ] );

	return { data, paginationInfo, isLoading, hasLoadedOnce, refresh };
}

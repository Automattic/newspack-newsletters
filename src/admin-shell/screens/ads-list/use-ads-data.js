/**
 * Server-side paginated data hook for the Ads list DataView.
 *
 * Wraps `apiFetch` against `/wp/v2/newspack_nl_ads_cpt`, reads
 * `X-WP-Total` / `X-WP-TotalPages` from the response headers, and
 * exposes a `refresh()` for action handlers (delete, restore, etc.)
 * to re-pull after a mutation.
 */

import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import { buildQueryParams, toQueryString } from './build-query';

const POSTS_PATH = '/wp/v2/newspack_nl_ads_cpt';

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

export default function useAdsData( view ) {
	const [ data, setData ] = useState( [] );
	const [ paginationInfo, setPaginationInfo ] = useState( { totalItems: 0, totalPages: 0 } );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ refreshKey, setRefreshKey ] = useState( 0 );

	const refresh = useCallback( () => setRefreshKey( key => key + 1 ), [] );

	useEffect( () => {
		let cancelled = false;
		setIsLoading( true );

		const path = `${ POSTS_PATH }${ toQueryString( buildQueryParams( view ) ) }`;

		apiFetch( { path, parse: false } )
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
				dispatch( noticesStore ).createErrorNotice( __( 'Failed to load ads. Please refresh the page.', 'newspack-newsletters' ), {
					id: 'newspack-newsletters-ads-list-fetch-error',
				} );
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoading( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [
		view.page,
		view.perPage,
		view.search,
		view.sort?.field,
		view.sort?.direction,
		// Filters are arrays of objects; serialise so React can compare them.
		JSON.stringify( view.filters || [] ),
		refreshKey,
	] );

	return { data, paginationInfo, isLoading, refresh };
}

/**
 * Server-side paginated data hook for the Newsletters list DataView.
 *
 * Wraps `apiFetch` against `/wp/v2/newspack_nl_cpt`, reads
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

const POSTS_PATH = '/wp/v2/newspack_nl_cpt';

// Parse a numeric header value, falling back to `0` for missing or
// malformed headers — `Number( header )` returns `NaN` for non-numeric
// strings, which would propagate into DataViews and break pagination.
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

export default function useNewslettersData( view ) {
	const [ data, setData ] = useState( [] );
	const [ paginationInfo, setPaginationInfo ] = useState( { totalItems: 0, totalPages: 0 } );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ refreshKey, setRefreshKey ] = useState( 0 );
	// `hasResolved` flips on either success or failure of the first fetch — drives the spinner gate so a first-load
	// error doesn't leave the screen stuck on the placeholder. `hasLoadedOnce` only flips on a successful response —
	// drives the strict-empty check so a transient fetch failure doesn't trigger the onboarding banner.
	const [ hasResolved, setHasResolved ] = useState( false );
	const [ hasLoadedOnce, setHasLoadedOnce ] = useState( false );
	// Tracks count of trashed newsletters so the empty state doesn't render when the only items are in Trash —
	// the user still needs the Status filter path to view / restore / delete them.
	const [ trashCount, setTrashCount ] = useState( 0 );

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
				setHasLoadedOnce( true );
			} )
			.catch( () => {
				if ( cancelled ) {
					return;
				}
				// Preserve last-good data on failure so a refetch error doesn't trigger the strict-empty banner.
				dispatch( noticesStore ).createErrorNotice( __( 'Failed to load newsletters. Please refresh the page.', 'newspack-newsletters' ), {
					id: 'newspack-newsletters-list-fetch-error',
				} );
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoading( false );
					setHasResolved( true );
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

	useEffect( () => {
		let cancelled = false;
		apiFetch( { path: `${ POSTS_PATH }?status=trash&per_page=1`, parse: false } )
			.then( response => {
				if ( ! cancelled ) {
					setTrashCount( parseHeaderInt( response.headers.get( 'X-WP-Total' ) ) );
				}
			} )
			.catch( () => {} );
		return () => {
			cancelled = true;
		};
	}, [ refreshKey ] );

	return { data, paginationInfo, isLoading, hasResolved, hasLoadedOnce, trashCount, refresh };
}

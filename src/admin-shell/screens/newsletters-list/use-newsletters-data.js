/**
 * Server-side paginated data hook for the Newsletters list DataView.
 */

import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { notifyError } from '../../notices';
import { buildQueryParams, toQueryString } from './build-query';

const POSTS_PATH = '/wp/v2/newspack_nl_cpt';

// Fall back to 0 so a missing or non-numeric header doesn't propagate NaN into DataViews pagination.
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
	// `*Resolved` flips on success OR failure (drives the spinner gate); `hasLoadedOnce` only on success
	// (gates the strict-empty banner so a transient error doesn't flash onboarding).
	const [ mainResolved, setMainResolved ] = useState( false );
	const [ trashResolved, setTrashResolved ] = useState( false );
	const [ hasLoadedOnce, setHasLoadedOnce ] = useState( false );
	// `null` = unknown; a failed trash fetch stays `null` so `=== 0` stays false and the banner stays hidden.
	const [ trashCount, setTrashCount ] = useState( null );

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
				// Keep last-good data so a refetch error doesn't trip the strict-empty banner.
				notifyError( __( 'Failed to load newsletters. Please refresh the page.', 'newspack-newsletters' ), {
					id: 'newspack-newsletters-list-fetch-error',
				} );
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoading( false );
					setMainResolved( true );
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
		// Filters are arrays of objects; serialise for referential equality.
		JSON.stringify( view.filters || [] ),
		refreshKey,
	] );

	useEffect( () => {
		let cancelled = false;
		// Back to "unknown" while the new count is in flight, or a freshly-trashed last item flashes EmptyState.
		setTrashCount( null );
		apiFetch( { path: `${ POSTS_PATH }?status=trash&per_page=1&context=edit`, parse: false } )
			.then( response => {
				if ( ! cancelled ) {
					setTrashCount( parseHeaderInt( response.headers.get( 'X-WP-Total' ) ) );
				}
			} )
			.catch( () => {} )
			.finally( () => {
				if ( ! cancelled ) {
					setTrashResolved( true );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [ refreshKey ] );

	const hasResolved = mainResolved && trashResolved;

	return { data, paginationInfo, isLoading, hasResolved, hasLoadedOnce, trashCount, refresh };
}

/**
 * Server-side paginated data hook for the Advertisers list DataView.
 *
 * Wraps `apiFetch` against `/wp/v2/newspack_nl_advertiser` and reads
 * `X-WP-Total` / `X-WP-TotalPages` from the response headers. Mutations
 * are driven from the screen via the `mutationKey` argument — bumping
 * it from the parent triggers a refetch so the action handlers don't
 * have to thread a refresh callback through props.
 *
 * Mirrors the ads list `use-ads-data` shape — kept screen-local rather
 * than promoted to a shared hook because the search-arg shapes diverge
 * across surfaces and the savings would be trivial.
 */

import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { buildQueryParams, toQueryString } from '../../utils/build-query';
import { notifyError } from '../../notices';

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
	return `${ TAXONOMY_PATH }${ toQueryString( buildQueryParams( view ) ) }`;
}

/**
 * @param {Object} view          DataViews view state.
 * @param {number} [mutationKey] Increment from the parent to force a
 *                               refetch after a mutation (Modal save,
 *                               per-row / bulk Delete). Shared with
 *                               `useAllAdvertisers` so both datasets
 *                               refetch in lockstep.
 * @return {{ data: Array, paginationInfo: Object, isLoading: boolean, hasLoadedOnce: boolean }} The current data, pagination info, and loading flags.
 */
export default function useAdvertisersData( view, mutationKey = 0 ) {
	const [ data, setData ] = useState( [] );
	const [ paginationInfo, setPaginationInfo ] = useState( { totalItems: 0, totalPages: 0 } );
	const [ isLoading, setIsLoading ] = useState( true );
	// `hasResolved` flips on either success or failure of the first fetch — drives the spinner gate so a first-load
	// error doesn't leave the screen stuck on the placeholder. `hasLoadedOnce` only flips on a successful response —
	// drives the strict-empty check so a transient fetch failure doesn't trigger the onboarding banner.
	const [ hasResolved, setHasResolved ] = useState( false );
	const [ hasLoadedOnce, setHasLoadedOnce ] = useState( false );

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
				// Only flip `hasLoadedOnce` after a successful response.
				// On error the catch path resets `paginationInfo` to
				// `{ totalItems: 0, totalPages: 0 }`; if the flag also
				// flipped here, the screen's `isStrictEmpty` check would
				// render the onboarding EmptyState for a failed load —
				// misleading (the list may be non-empty, it just
				// couldn't be fetched). Keeping the flag tied to a
				// confirmed totalItems read keeps the empty state honest.
				setHasLoadedOnce( true );
			} )
			.catch( () => {
				if ( cancelled ) {
					return;
				}
				// Don't clobber `data` or `paginationInfo` on failure.
				// Two reasons: (1) on first-load failure they're still
				// at their initial empty values, so resetting is a
				// no-op; (2) on a later-refresh failure (page change,
				// filter change, post-mutation refetch), preserving
				// the last good data keeps the DataView populated and
				// prevents `isStrictEmpty` from spuriously rendering
				// the onboarding EmptyState — the failure surfaces via
				// the error notice instead.
				notifyError( __( 'Failed to load advertisers. Please refresh the page.', 'newspack-newsletters' ), {
					id: 'newspack-newsletters-advertisers-list-fetch-error',
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
	}, [ view.page, view.perPage, view.search, view.sort?.field, view.sort?.direction, mutationKey ] );

	return { data, paginationInfo, isLoading, hasResolved, hasLoadedOnce };
}

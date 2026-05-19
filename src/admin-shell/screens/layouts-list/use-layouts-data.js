/**
 * Server-side paginated data hook for the Layouts list DataView.
 * Mirrors the ads list / advertisers list shape.
 */

import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { LAYOUT_CPT_SLUG } from '../../../utils/consts';
import { buildQueryParams, toQueryString } from '../../utils/build-query';
import { notifyError } from '../../notices';

const COLLECTION_PATH = `/wp/v2/${ LAYOUT_CPT_SLUG }`;

// `auto-draft` keeps an abandoned "Add new" visible. `future` is excluded
// — layouts don't surface scheduling.
const DEFAULT_STATUSES = 'publish,private,draft,pending,auto-draft';

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
	const params = buildQueryParams( view, {
		defaultPerPage: 12,
		defaultStatuses: DEFAULT_STATUSES,
		// `offset` overrides `page` so page 1 can reserve slots for prebuilts
		// and subsequent pages start mid-collection.
		supportsOffset: true,
		// Legacy `_embed=1` form — layouts pull author + taxonomy + revisions
		// in one request for the grid preview tooltip.
		extraParams: { _embed: '1' },
		arrayParams: [ { viewKey: 'author', param: 'author' } ],
	} );
	return `${ COLLECTION_PATH }${ toQueryString( params ) }`;
}

/**
 * @param {Object} view          DataViews view state.
 * @param {number} [mutationKey] Increment from the parent to force a refetch after a mutation.
 * @return {{ data: Array, paginationInfo: Object, isLoading: boolean, hasResolved: boolean, hasLoadedOnce: boolean }} The current data, pagination info, and loading flags.
 */
export default function useLayoutsData( view, mutationKey = 0 ) {
	const [ data, setData ] = useState( [] );
	const [ paginationInfo, setPaginationInfo ] = useState( { totalItems: 0, totalPages: 0 } );
	const [ isLoading, setIsLoading ] = useState( true );
	// `hasResolved` flips on success or failure of the first real fetch
	// (deliberately stays false while `view === null` — flipping there
	// races the parent latch on null → non-null transitions).
	// `hasLoadedOnce` only flips on success.
	const [ hasResolved, setHasResolved ] = useState( false );
	const [ hasLoadedOnce, setHasLoadedOnce ] = useState( false );

	useEffect( () => {
		if ( ! view ) {
			setData( [] );
			setPaginationInfo( { totalItems: 0, totalPages: 0 } );
			setIsLoading( false );
			return undefined;
		}
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
				setHasLoadedOnce( true );
			} )
			.catch( () => {
				if ( cancelled ) {
					return;
				}
				// Preserve the last good page on failure — a transient
				// network error shouldn't blank the screen.
				notifyError( __( 'Failed to load layouts. Please refresh the page.', 'newspack-newsletters' ), {
					id: 'newspack-newsletters-layouts-list-fetch-error',
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
		view?.page,
		view?.perPage,
		view?.offset,
		view?.search,
		view?.sort?.field,
		view?.sort?.direction,
		// Stringify so reference-only changes to the array don't refetch.
		Array.isArray( view?.author ) ? view.author.join( ',' ) : '',
		mutationKey,
	] );

	return { data, paginationInfo, isLoading, hasResolved, hasLoadedOnce };
}

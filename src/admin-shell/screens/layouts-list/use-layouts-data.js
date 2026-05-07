/**
 * Server-side paginated data hook for the Layouts list DataView.
 * Mirrors the ads list / advertisers list shape.
 */

import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import { LAYOUT_CPT_SLUG } from '../../../utils/consts';

const COLLECTION_PATH = `/wp/v2/${ LAYOUT_CPT_SLUG }`;

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
	// `offset` overrides `page` so page 1 can reserve slots for prebuilts
	// and subsequent pages start mid-collection.
	if ( typeof view.offset === 'number' ) {
		params.set( 'offset', String( view.offset ) );
	} else {
		params.set( 'page', String( view.page || 1 ) );
	}
	params.set( 'per_page', String( view.perPage || 12 ) );
	params.set( 'context', 'edit' );
	if ( view.search ) {
		params.set( 'search', view.search );
	}
	if ( view.sort?.field ) {
		params.set( 'orderby', view.sort.field );
		params.set( 'order', view.sort.direction === 'asc' ? 'asc' : 'desc' );
	}
	// `auto-draft` keeps an abandoned "Add new" visible. `future` is excluded
	// — layouts don't surface scheduling.
	params.set( 'status', 'publish,private,draft,pending,auto-draft' );
	params.set( '_embed', '1' );
	if ( Array.isArray( view.author ) && view.author.length > 0 ) {
		params.set( 'author', view.author.join( ',' ) );
	}
	return `${ COLLECTION_PATH }?${ params.toString() }`;
}

/**
 * @param {Object} view          DataViews view state.
 * @param {number} [mutationKey] Increment from the parent to force a refetch after a mutation.
 * @return {{ data: Array, paginationInfo: Object, isLoading: boolean, hasLoadedOnce: boolean }} The current data, pagination info, and loading flags.
 */
export default function useLayoutsData( view, mutationKey = 0 ) {
	const [ data, setData ] = useState( [] );
	const [ paginationInfo, setPaginationInfo ] = useState( { totalItems: 0, totalPages: 0 } );
	const [ isLoading, setIsLoading ] = useState( true );
	// Distinguishes "still fetching" from "really empty" so the screen
	// doesn't flash an empty grid on first paint.
	const [ hasLoadedOnce, setHasLoadedOnce ] = useState( false );

	useEffect( () => {
		if ( ! view ) {
			setData( [] );
			setPaginationInfo( { totalItems: 0, totalPages: 0 } );
			setIsLoading( false );
			setHasLoadedOnce( true );
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
				dispatch( noticesStore ).createErrorNotice( __( 'Failed to load layouts. Please refresh the page.', 'newspack-newsletters' ), {
					id: 'newspack-newsletters-layouts-list-fetch-error',
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

	return { data, paginationInfo, isLoading, hasLoadedOnce };
}

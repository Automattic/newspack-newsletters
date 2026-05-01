/**
 * Server-side paginated data hook for the Layouts list DataView.
 *
 * Wraps `apiFetch` against `/wp/v2/newspack_nl_layo_cpt` with
 * `context=edit` so the response carries `content.raw` (parseable
 * blocks for the preview) and the registered meta. Pagination
 * headers come from `X-WP-Total` / `X-WP-TotalPages`. Mutations are
 * driven from the screen via `mutationKey` — bumping it triggers a
 * refetch so action handlers don't have to thread a refresh callback.
 *
 * Mirrors `useAdvertisersData` / the ads list `use-ads-data` shape;
 * kept screen-local because the layouts query has no filter params
 * beyond search/sort/page and the savings of promoting to a shared
 * hook would be trivial.
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
	params.set( 'page', String( view.page || 1 ) );
	params.set( 'per_page', String( view.perPage || 12 ) );
	// `context=edit` so the response includes `content.raw` (the
	// preview parses it back into blocks) and the registered meta
	// fields the duplicate flow copies.
	params.set( 'context', 'edit' );
	if ( view.search ) {
		params.set( 'search', view.search );
	}
	if ( view.sort?.field ) {
		params.set( 'orderby', view.sort.field );
		params.set( 'order', view.sort.direction === 'asc' ? 'asc' : 'desc' );
	}
	// Status default for the standard CPT collection in `context=edit`
	// is `publish,future,draft,pending,private`. Saved layouts are
	// always created as `publish` and the editor doesn't surface the
	// other statuses for this CPT, but be explicit so any future drift
	// (e.g. autosave revisions) doesn't silently leak rows.
	params.set( 'status', 'publish,private' );
	return `${ COLLECTION_PATH }?${ params.toString() }`;
}

/**
 * @param {Object} view          DataViews view state.
 * @param {number} [mutationKey] Increment from the parent to force a
 *                               refetch after a mutation (Rename,
 *                               Duplicate, Delete, bulk Delete).
 * @return {{ data: Array, paginationInfo: Object, isLoading: boolean, hasLoadedOnce: boolean }} The current data, pagination info, and loading flags.
 */
export default function useLayoutsData( view, mutationKey = 0 ) {
	const [ data, setData ] = useState( [] );
	const [ paginationInfo, setPaginationInfo ] = useState( { totalItems: 0, totalPages: 0 } );
	const [ isLoading, setIsLoading ] = useState( true );
	// Track whether at least one fetch has resolved. Without it the
	// screen can't tell "still fetching" apart from "really empty" and
	// would flash an empty grid on first paint.
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
				setHasLoadedOnce( true );
			} )
			.catch( () => {
				if ( cancelled ) {
					return;
				}
				// Don't clobber `data` or `paginationInfo` on failure —
				// preserve the last good page so a transient network
				// error doesn't blank the screen. The error notice
				// surfaces the failure; a manual refresh recovers.
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
	}, [ view.page, view.perPage, view.search, view.sort?.field, view.sort?.direction, mutationKey ] );

	return { data, paginationInfo, isLoading, hasLoadedOnce };
}

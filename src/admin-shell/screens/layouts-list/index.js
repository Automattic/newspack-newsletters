/**
 * Layouts list screen — React DataView for managing newsletter
 * layouts. Lists bundled prebuilts alongside user-saved layouts;
 * prebuilts are fully locked/passive in this view (no Edit, Rename,
 * Delete, or Duplicate — actions menu and selection checkbox are
 * suppressed entirely; the title row carries a lock icon instead).
 * Mounts at `?page=newspack-newsletters-layouts-list`. Server-side
 * paginated; default layout is Grid with a live `<NewsletterPreview>`
 * per card. The header CTA opens the dedicated layout editor at
 * `post-new.php?post_type=…layo_cpt`; the editor's "Save as layout"
 * dispatch remains a parallel entry point on the newsletter side.
 */

import { getBlockType, registerBlockType } from '@wordpress/blocks';
import { registerCoreBlocks } from '@wordpress/block-library';
import { DataViews } from '@wordpress/dataviews/wp';
import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import { getAdminUrl } from '../../admin-globals';
import { useHeaderActions } from '../../header-actions-context';
import { LAYOUT_CPT_SLUG } from '../../../utils/consts';
import useLayoutsData from './use-layouts-data';
import usePrebuiltLayouts from './use-prebuilt-layouts';
import { getFields, PREBUILT_AUTHOR_VALUE } from './fields';
import { getActions, renameLayout } from './actions';
import { getInitialView } from './initial-filters';

/**
 * Register the core block library on first mount so `parse()` resolves
 * blocks instead of dropping unknown ones.
 *
 * The admin-shell page isn't a post editor, so the standard block
 * registration that happens on `post.php` doesn't run here. Without
 * this, `parse('<!-- wp:paragraph -->…<!-- /wp:paragraph -->')` returns
 * `[]` and every card renders the empty-layout placeholder.
 *
 * Newspack-specific blocks (`newspack-newsletters/posts-inserter`,
 * `…/share`, `…/ad`) intentionally aren't registered here — they live
 * in the much heavier newsletter-editor bundle and pulling that in for
 * the management surface isn't worth the cost. Core blocks dominate
 * layout structure in practice; Newspack blocks render as
 * "block-not-found" placeholders in the preview, which is acceptable
 * for a recognition-grade thumbnail (the user can click through to
 * Edit for full fidelity).
 *
 * Idempotent — guarded against re-registration so navigating away and
 * back doesn't trigger the "Block already registered" warning.
 */
function ensureCoreBlocksRegistered() {
	if ( typeof getBlockType === 'function' && getBlockType( 'core/paragraph' ) ) {
		return;
	}
	if ( typeof registerCoreBlocks === 'function' ) {
		registerCoreBlocks();
		return;
	}
	if ( typeof registerBlockType === 'function' ) {
		// Defensive fallback for environments without the block-library
		// package: register a minimal paragraph block so the screen at
		// least renders text content.
		registerBlockType( 'core/paragraph', {
			title: __( 'Paragraph', 'newspack-newsletters' ),
			save: () => null,
		} );
	}
}

const DEFAULT_VIEW = {
	type: 'grid',
	page: 1,
	// Lower than the chassis default of 25 because each card mounts an
	// iframe via `<BlockPreview>` — even with `LazyPreview` deferring
	// off-screen mounts, 25 in-viewport iframes can stutter on first
	// paint. 12 fits a typical 2-3 column grid without scroll.
	perPage: 12,
	sort: { field: 'modified', direction: 'desc' },
	search: '',
	filters: [],
	titleField: 'title',
	mediaField: 'preview',
	// Author shows below the title in grid mode (Templates-style) and
	// as a column in table mode. `modified` stays available via "Show
	// fields" but isn't visible by default to keep the card compact.
	fields: [ 'author' ],
	...getInitialView(),
};

const DEFAULT_LAYOUTS = {
	grid: {},
	table: {},
};

export default function LayoutsListScreen() {
	useEffect( () => {
		ensureCoreBlocksRegistered();
	}, [] );

	const [ view, setView ] = useState( DEFAULT_VIEW );
	const [ renamingId, setRenamingId ] = useState( null );
	// Single mutation trigger shared by every write path (Rename,
	// Duplicate, Delete, bulk Delete). Bumping it forces a refetch.
	const [ mutationKey, setMutationKey ] = useState( 0 );

	const { layouts: prebuiltData, isLoading: isPrebuiltLoading } = usePrebuiltLayouts();

	// Resolve the author filter from `view.filters`. Two buckets:
	//
	//   - `showPrebuilts`         — prebuilt set eligible for the merged view.
	//   - `restrictedAuthorIds`   — positive include-list to constrain the saved fetch by (REST `author=` param).
	//   - `savedFetchAllAuthors`  — fetch the saved collection without any author param.
	//
	// `'newspack'` is the prebuilt sentinel (id=0 in the data shape);
	// real WP user IDs (positive integers) address saved layouts. The
	// field's `filterBy.operators` list excludes `isNone` because the
	// REST collection has no "exclude author" parameter and applying
	// the exclusion client-side would leave gaps on filtered pages
	// (see fields.js). Any stray `isNone` filter (URL-seeded, etc.)
	// is treated as no-op so the screen falls through to the
	// unfiltered render.
	const authorFilterResolution = useMemo( () => {
		const filter = ( view.filters || [] ).find( f => f.field === 'author' );
		const noFilter = { showPrebuilts: true, restrictedAuthorIds: [], savedFetchAllAuthors: true };
		if ( ! filter || filter.operator === 'isNone' ) {
			return noFilter;
		}
		const raw = filter.value;
		const values = ( Array.isArray( raw ) ? raw : [ raw ] ).filter( v => v !== undefined && v !== null && v !== '' );
		if ( values.length === 0 ) {
			return noFilter;
		}
		const includesNewspack = values.includes( PREBUILT_AUTHOR_VALUE );
		const userIds = values
			.filter( v => v !== PREBUILT_AUTHOR_VALUE )
			.map( v => Number( v ) )
			.filter( n => Number.isFinite( n ) && n > 0 );

		// `is` / `isAny` — include only the listed values. Saved data
		// is fetched only when at least one user ID is included; a
		// filter limited to `'newspack'` shows prebuilts alone.
		return {
			showPrebuilts: includesNewspack,
			restrictedAuthorIds: userIds,
			savedFetchAllAuthors: false,
		};
	}, [ view.filters ] );

	const { showPrebuilts: authorShowPrebuilts, restrictedAuthorIds, savedFetchAllAuthors } = authorFilterResolution;
	const showSaved = savedFetchAllAuthors || restrictedAuthorIds.length > 0;

	// Prebuilts only show on page 1 of the unfiltered "include
	// prebuilts" view. Search hides them entirely (titles aren't
	// indexed against the parsed block content). Pinning them on top
	// reserves N slots out of `view.perPage` on page 1, so the saved
	// query is offset-paginated to fill the remaining slots and pick
	// up where page 1 left off on subsequent pages.
	const showPrebuilts = authorShowPrebuilts && view.page === 1 && ! view.search;
	const prebuiltCount = prebuiltData.length;
	// "Could ride along" — independent of whether prebuilts have loaded.
	// Used to defer the saved fetch until the prebuilt count is known,
	// so the saved query targets the correct slot count from the first
	// request instead of refetching once prebuilts arrive.
	const couldRideAlong = authorShowPrebuilts && ! view.search;
	const ridingAlong = couldRideAlong && prebuiltCount > 0;
	const firstPageSavedSlots = ridingAlong ? Math.max( 1, view.perPage - prebuiltCount ) : view.perPage;

	const savedView = useMemo( () => {
		if ( ! showSaved ) {
			return null;
		}
		// While prebuilts are still loading on a view where they would
		// ride along, hold the saved fetch — otherwise the first request
		// uses `view.perPage` rows, then refetches with a smaller slot
		// count once prebuilts arrive (visible flicker + extra request).
		if ( couldRideAlong && isPrebuiltLoading ) {
			return null;
		}
		const baseView = restrictedAuthorIds.length > 0 ? { ...view, author: restrictedAuthorIds } : view;
		if ( ridingAlong ) {
			if ( view.page === 1 ) {
				return { ...baseView, perPage: firstPageSavedSlots, offset: 0 };
			}
			return { ...baseView, offset: firstPageSavedSlots + ( view.page - 2 ) * view.perPage };
		}
		return baseView;
	}, [ view, showSaved, couldRideAlong, isPrebuiltLoading, ridingAlong, firstPageSavedSlots, restrictedAuthorIds ] );

	const { data: savedData, paginationInfo: savedPagination, isLoading } = useLayoutsData( savedView, mutationKey );

	const filteredPrebuilts = showPrebuilts ? prebuiltData : [];
	const filteredSaved = showSaved ? savedData : [];

	const data = useMemo( () => [ ...filteredPrebuilts, ...filteredSaved ], [ filteredPrebuilts, filteredSaved ] );

	// Author filter elements. Prebuilts are pinned as `'newspack'`; the
	// rest is derived from the embedded author shape on the loaded saved
	// rows. The set grows as the user pages through, but a static list
	// would require a server-side enumeration of every author who owns
	// a layout — unnecessary for v1.
	const authorElements = useMemo( () => {
		const elements = [ { value: PREBUILT_AUTHOR_VALUE, label: __( 'Newspack', 'newspack-newsletters' ) } ];
		const seen = new Set();
		savedData.forEach( item => {
			const author = item?._embedded?.author?.[ 0 ];
			const id = author?.id;
			const name = author?.name;
			if ( id && name && ! seen.has( id ) ) {
				seen.add( id );
				elements.push( { value: String( id ), label: name } );
			}
		} );
		return elements;
	}, [ savedData ] );

	const paginationInfo = useMemo( () => {
		// Prebuilt-only filter: the entire prebuilt set fits in one batch.
		if ( ! showSaved ) {
			return { totalItems: prebuiltCount, totalPages: 1 };
		}
		// Saved-only (search or user filter): standard saved pagination.
		if ( ! ridingAlong ) {
			return {
				totalItems: savedPagination.totalItems,
				totalPages: Math.max( 1, savedPagination.totalPages ),
			};
		}
		// Mixed: page 1 holds `firstPageSavedSlots` saved + all prebuilts;
		// the remaining saved spread across subsequent pages of `perPage`.
		// `prebuiltCount` belongs in the total whenever the filter
		// includes prebuilts — keying on `authorShowPrebuilts` instead
		// of the per-page `showPrebuilts` keeps the total stable as the
		// user pages through (prebuilts only render on page 1, but
		// they're still part of the result set on later pages).
		const remainingSaved = Math.max( 0, savedPagination.totalItems - firstPageSavedSlots );
		const totalPages = 1 + Math.ceil( remainingSaved / view.perPage );
		return {
			totalItems: savedPagination.totalItems + ( authorShowPrebuilts ? prebuiltCount : 0 ),
			totalPages: Math.max( 1, totalPages ),
		};
	}, [ savedPagination, prebuiltCount, showSaved, authorShowPrebuilts, ridingAlong, firstPageSavedSlots, view.perPage ] );

	// `mediaField` is grid-only by intent — the preview mounts an iframe
	// per row, which is fine in a card layout but blows out row heights
	// in table mode (each row reserves ~320px). DataView's table layout
	// renders the mediaField as a leftmost media cell when present, so
	// strip it on layout switches and restore it when returning to grid.
	const onChangeView = useCallback( next => {
		if ( next.type === 'table' ) {
			setView( { ...next, mediaField: undefined } );
		} else if ( next.type === 'grid' && ! next.mediaField ) {
			setView( { ...next, mediaField: 'preview' } );
		} else {
			setView( next );
		}
	}, [] );

	const onMutated = useCallback( () => setMutationKey( key => key + 1 ), [] );

	const startRenaming = useCallback( item => {
		setRenamingId( item?.id ?? null );
	}, [] );
	const cancelRenaming = useCallback( () => setRenamingId( null ), [] );
	const commitRename = useCallback(
		async ( item, nextTitle ) => {
			try {
				await renameLayout( item.id, nextTitle );
				setRenamingId( null );
				onMutated();
				dispatch( noticesStore ).createSuccessNotice( __( 'Layout renamed.', 'newspack-newsletters' ) );
			} catch ( error ) {
				dispatch( noticesStore ).createErrorNotice( __( 'Failed to rename layout.', 'newspack-newsletters' ) );
				throw error;
			}
		},
		[ onMutated ]
	);

	const fields = useMemo(
		() => getFields( { renamingId, onRenameCommit: commitRename, onRenameCancel: cancelRenaming, authorElements } ),
		[ renamingId, commitRename, cancelRenaming, authorElements ]
	);
	const actions = useMemo( () => getActions( { onRenameStart: startRenaming, onMutated } ), [ startRenaming, onMutated ] );

	useHeaderActions(
		useMemo(
			() => [
				{
					type: 'primary',
					label: __( 'Add new layout', 'newspack-newsletters' ),
					href: `${ getAdminUrl() }post-new.php?post_type=${ LAYOUT_CPT_SLUG }`,
				},
			],
			[]
		)
	);

	return (
		<DataViews
			className="newspack-newsletters-list newspack-newsletters-layouts-list"
			data={ data }
			fields={ fields }
			view={ view }
			onChangeView={ onChangeView }
			actions={ actions }
			paginationInfo={ paginationInfo }
			defaultLayouts={ DEFAULT_LAYOUTS }
			isLoading={ isLoading || isPrebuiltLoading }
			getItemId={ item => String( item.id ) }
			search
		/>
	);
}

/**
 * Layouts list screen — React DataView for managing newsletter
 * layouts. Lists bundled prebuilts alongside user-saved layouts;
 * prebuilts are read-only with Duplicate as the only available
 * action. Mounts at `?page=newspack-newsletters-layouts-list`.
 * Server-side paginated; default layout is Grid with a live
 * `<NewsletterPreview>` per card. The header CTA opens the
 * dedicated layout editor at `post-new.php?post_type=…layo_cpt`;
 * the editor's "Save as layout" dispatch remains a parallel
 * entry point on the newsletter side.
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
import { getFields } from './fields';
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
	fields: [ 'modified' ],
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

	// Resolve the type filter from `view.filters`. Returns `'prebuilt'`,
	// `'user'`, or `null` when neither is exclusively selected (both /
	// none / unrelated filters all reduce to `null`, meaning "show
	// both"). DataView's filter shape allows multiple operators
	// (`is`, `isAny`, `isNone`); collapse them to the on-screen
	// behaviour we care about.
	const typeFilter = useMemo( () => {
		const filter = ( view.filters || [] ).find( f => f.field === 'type' );
		if ( ! filter ) {
			return null;
		}
		const value = filter.value;
		const values = Array.isArray( value ) ? value : [ value ];
		if ( filter.operator === 'isNone' ) {
			// `isNone` excludes the listed values — invert to include the others.
			if ( values.includes( 'prebuilt' ) && ! values.includes( 'user' ) ) {
				return 'user';
			}
			if ( values.includes( 'user' ) && ! values.includes( 'prebuilt' ) ) {
				return 'prebuilt';
			}
			return null;
		}
		// `is` / `isAny` — include the listed values. A selection of
		// both reduces to "show both" (null) since that's the default.
		if ( values.includes( 'prebuilt' ) && values.includes( 'user' ) ) {
			return null;
		}
		if ( values.includes( 'prebuilt' ) ) {
			return 'prebuilt';
		}
		if ( values.includes( 'user' ) ) {
			return 'user';
		}
		return null;
	}, [ view.filters ] );

	// Prebuilts only show on page 1 of the unfiltered "include
	// prebuilts" view. Search hides them entirely (titles aren't
	// indexed against the parsed block content). Pinning them on top
	// reserves N slots out of `view.perPage` on page 1, so the saved
	// query is offset-paginated to fill the remaining slots and pick
	// up where page 1 left off on subsequent pages.
	const showPrebuilts = view.page === 1 && ! view.search && typeFilter !== 'user';
	const showSaved = typeFilter !== 'prebuilt';
	const prebuiltCount = prebuiltData.length;
	// "Could ride along" — independent of whether prebuilts have loaded.
	// Used to defer the saved fetch until the prebuilt count is known,
	// so the saved query targets the correct slot count from the first
	// request instead of refetching once prebuilts arrive.
	const couldRideAlong = ! view.search && typeFilter !== 'user';
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
		if ( ridingAlong ) {
			if ( view.page === 1 ) {
				return { ...view, perPage: firstPageSavedSlots, offset: 0 };
			}
			return { ...view, offset: firstPageSavedSlots + ( view.page - 2 ) * view.perPage };
		}
		return view;
	}, [ view, showSaved, couldRideAlong, isPrebuiltLoading, ridingAlong, firstPageSavedSlots ] );

	const { data: savedData, paginationInfo: savedPagination, isLoading } = useLayoutsData( savedView, mutationKey );

	const filteredPrebuilts = showPrebuilts ? prebuiltData : [];
	const filteredSaved = showSaved ? savedData : [];

	const data = useMemo( () => [ ...filteredPrebuilts, ...filteredSaved ], [ filteredPrebuilts, filteredSaved ] );

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
		const remainingSaved = Math.max( 0, savedPagination.totalItems - firstPageSavedSlots );
		const totalPages = 1 + Math.ceil( remainingSaved / view.perPage );
		return {
			totalItems: savedPagination.totalItems + prebuiltCount,
			totalPages: Math.max( 1, totalPages ),
		};
	}, [ savedPagination, prebuiltCount, showSaved, ridingAlong, firstPageSavedSlots, view.perPage ] );

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
		() => getFields( { renamingId, onRenameCommit: commitRename, onRenameCancel: cancelRenaming } ),
		[ renamingId, commitRename, cancelRenaming ]
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

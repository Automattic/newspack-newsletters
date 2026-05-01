/**
 * Advertisers list screen — React DataView replacing the classic
 * taxonomy term-management screen for `newspack_nl_advertiser` (NEWS-1951).
 *
 * Mounts at `?page=newspack-newsletters-advertisers-list` (registered
 * in `Advertisers_List_Page`). Server-side paginated; columns are
 * Name / Description / Slug / Count.
 *
 * Two REST fetches drive the screen: `useAdvertisersData` is the
 * paginated DataView fetch; `useAllAdvertisers` is a separate
 * lightweight fetch (`id`, `name`, `parent` only) that powers the
 * Modal's parent picker. Without the second fetch the picker would
 * silently truncate to the current DataView page on sites with more
 * than one page of advertisers.
 */

import { DataViews } from '@wordpress/dataviews/wp';
import { useCallback, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { group, plus } from '@wordpress/icons';

import EmptyState from '../../components/empty-state';
import { useHeaderActions } from '../../header-actions-context';
import AdvertiserModal from './modal';
import useAdvertisersData from './use-advertisers-data';
import useAllAdvertisers from './use-all-advertisers';
import { getInitialView } from './initial-filters';
import { getFields } from './fields';
import { getActions } from './actions';

const DEFAULT_VIEW = {
	type: 'table',
	page: 1,
	perPage: 25,
	sort: { field: 'name', direction: 'asc' },
	search: '',
	filters: [],
	titleField: 'name',
	fields: [ 'description', 'slug', 'count' ],
	...getInitialView(),
};

const DEFAULT_LAYOUTS = { table: {} };

export default function AdvertisersListScreen() {
	const [ view, setView ] = useState( DEFAULT_VIEW );
	const [ modalState, setModalState ] = useState( null ); // null | { mode: 'add' | 'edit', advertiser?: Object }
	// Bumped after every successful Modal save so both the paginated
	// DataView fetch and the parent-picker tree refetch in lockstep —
	// keeps newly-created or renamed advertisers visible immediately.
	const [ saveCounter, setSaveCounter ] = useState( 0 );

	const { data, paginationInfo, isLoading, hasLoadedOnce, refresh } = useAdvertisersData( view, saveCounter );
	const allAdvertisers = useAllAdvertisers( saveCounter );

	// `setModalState` (a `useState` setter) is itself stable, but wrapping
	// the modal handlers in `useCallback` keeps their identities stable
	// across renders so the `useMemo`s below — which capture them — don't
	// have to choose between (a) re-running every render or (b) lying to
	// the hooks-deps lint rule with an empty deps array.
	const openAdd = useCallback( () => setModalState( { mode: 'add' } ), [] );
	const openEdit = useCallback( advertiser => setModalState( { mode: 'edit', advertiser } ), [] );
	const closeModal = useCallback( () => setModalState( null ), [] );
	const onModalSaved = useCallback( () => setSaveCounter( count => count + 1 ), [] );

	const fields = useMemo( () => getFields( { onEdit: openEdit } ), [ openEdit ] );
	const actions = useMemo( () => getActions( { onEdit: openEdit, refresh } ), [ openEdit, refresh ] );

	useHeaderActions(
		useMemo(
			() => [
				{
					type: 'primary',
					label: __( 'Add new advertiser', 'newspack-newsletters' ),
					onClick: openAdd,
				},
			],
			[ openAdd ]
		)
	);

	// Strict-empty: the list has loaded at least once and the unfiltered
	// total is zero. Filter / search empty-results keep the DataView's
	// built-in "no results" treatment — different surface, different
	// intent. Loading state suppresses the empty banner so it doesn't
	// flash before the first fetch resolves.
	const isStrictEmpty =
		hasLoadedOnce && ! isLoading && paginationInfo.totalItems === 0 && ! view.search && ( ! view.filters || view.filters.length === 0 );

	return (
		<>
			{ isStrictEmpty ? (
				<EmptyState
					icon={ group }
					title={ __( 'Get started with advertisers', 'newspack-newsletters' ) }
					description={ __(
						'Group ads by the advertiser they belong to so you can track and report on each one separately.',
						'newspack-newsletters'
					) }
					ctaIcon={ plus }
					ctaTitle={ __( 'Add new advertiser', 'newspack-newsletters' ) }
					ctaDescription={ __( 'Create your first advertiser to assign to newsletter ads.', 'newspack-newsletters' ) }
					ctaOnClick={ openAdd }
				/>
			) : (
				<DataViews
					className="newspack-newsletters-list newspack-newsletters-advertisers-list"
					data={ data }
					fields={ fields }
					view={ view }
					onChangeView={ setView }
					actions={ actions }
					paginationInfo={ paginationInfo }
					defaultLayouts={ DEFAULT_LAYOUTS }
					isLoading={ isLoading }
					getItemId={ item => String( item.id ) }
					search
				/>
			) }

			{ modalState && (
				<AdvertiserModal
					advertiser={ modalState.mode === 'edit' ? modalState.advertiser : null }
					advertisers={ allAdvertisers }
					onClose={ closeModal }
					onSaved={ onModalSaved }
				/>
			) }
		</>
	);
}

/**
 * Newsletters list screen — React DataView replacing the classic CPT list.
 *
 * Mounts at `?page=newspack-newsletters-list` (registered in
 * `Newsletters_List_Page`). Server-side paginated; the Status column
 * uses the consolidated `newspack_newsletters_status` REST field.
 */

import { DataViews } from '@wordpress/dataviews/wp';
import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { getAdminUrl, getCptSlug } from '../../admin-globals';
import { useHeaderActions } from '../../header-actions-context';
import useNewslettersData from './use-newsletters-data';
import { getFields } from './fields';
import { getActions } from './actions';
import { getInitialView } from './initial-filters';

// Spread the URL-seeded patch last so anything forwarded from the
// legacy CPT URL (status filter, search term, sort) overrides the
// defaults — see `Admin_Shell::maybe_redirect_legacy_list` and
// `getInitialView`.
const DEFAULT_VIEW = {
	type: 'table',
	page: 1,
	perPage: 25,
	sort: { field: 'date', direction: 'desc' },
	search: '',
	filters: [],
	titleField: 'title',
	fields: [ 'status', 'send_date', 'send_list', 'author', 'categories', 'public_page', 'date' ],
	...getInitialView(),
};

const DEFAULT_LAYOUTS = { table: {} };

export default function NewslettersListScreen() {
	const [ view, setView ] = useState( DEFAULT_VIEW );
	const { data, paginationInfo, isLoading, refresh } = useNewslettersData( view );

	const fields = useMemo( () => getFields(), [] );
	const actions = useMemo( () => getActions( { refresh } ), [ refresh ] );

	useHeaderActions(
		useMemo(
			() => [
				{
					type: 'primary',
					label: __( 'Add new newsletter', 'newspack-newsletters' ),
					href: `${ getAdminUrl() }post-new.php?post_type=${ getCptSlug() }`,
				},
			],
			[]
		)
	);

	return (
		<DataViews
			className="newspack-newsletters-list"
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
	);
}

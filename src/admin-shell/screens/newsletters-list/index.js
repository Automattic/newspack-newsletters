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

import { useHeaderActions } from '../../header-actions-context';
import useNewslettersData from './use-newsletters-data';
import { getFields } from './fields';
import { getActions } from './actions';
import { getInitialFilters } from './initial-filters';

const DEFAULT_VIEW = {
	type: 'table',
	page: 1,
	perPage: 25,
	sort: { field: 'date', direction: 'desc' },
	search: '',
	// Pre-fill from `?post_status=` if the page was reached via the legacy
	// CPT URL — see `Admin_Shell::maybe_redirect_legacy_list`.
	filters: getInitialFilters(),
	titleField: 'title',
	fields: [ 'status', 'send_date', 'send_list', 'author', 'public_page' ],
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
					href: `${ window.newspackNewslettersAdmin.adminUrl }post-new.php?post_type=${ window.newspackNewslettersAdmin.cptSlug }`,
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

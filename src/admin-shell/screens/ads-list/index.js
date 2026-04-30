/**
 * Ads list screen — React DataView replacing the classic ads CPT list.
 *
 * Mounts at `?page=newspack-newsletters-ads-list` (registered in
 * `Ads_List_Page`). Server-side paginated; the Status column uses the
 * consolidated `newspack_newsletters_ad_status` REST field.
 */

import apiFetch from '@wordpress/api-fetch';
import { DataViews } from '@wordpress/dataviews/wp';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { getAdminUrl } from '../../admin-globals';
import { useHeaderActions } from '../../header-actions-context';
import useAdsData from './use-ads-data';
import { getFields } from './fields';
import { getActions } from './actions';
import { getInitialView } from './initial-filters';

const DEFAULT_VIEW = {
	type: 'table',
	page: 1,
	perPage: 25,
	sort: { field: 'date', direction: 'desc' },
	search: '',
	filters: [],
	titleField: 'title',
	fields: [ 'advertiser', 'ad_placement', 'status', 'start_date', 'expiry_date', 'impressions', 'clicks', 'price' ],
	...getInitialView(),
};

const DEFAULT_LAYOUTS = { table: {} };

const ADS_CPT = 'newspack_nl_ads_cpt';

// Lightweight one-shot fetch for the taxonomy term sets that drive the
// Advertiser / Ad placement filter dropdowns. The list itself is small
// (typically a few dozen entries) and rarely changes during a session,
// so a single fetch when the screen mounts is enough.
function useFilterTerms() {
	const [ terms, setTerms ] = useState( { advertisers: [], placements: [] } );

	useEffect( () => {
		let cancelled = false;
		Promise.all( [
			apiFetch( { path: '/wp/v2/newspack_nl_advertiser?per_page=100&_fields=id,name' } ).catch( () => [] ),
			apiFetch( { path: '/wp/v2/ad_placement?per_page=100&_fields=id,name' } ).catch( () => [] ),
		] ).then( ( [ advertisers, placements ] ) => {
			if ( cancelled ) {
				return;
			}
			setTerms( {
				advertisers: Array.isArray( advertisers ) ? advertisers : [],
				placements: Array.isArray( placements ) ? placements : [],
			} );
		} );
		return () => {
			cancelled = true;
		};
	}, [] );

	return terms;
}

export default function AdsListScreen() {
	const [ view, setView ] = useState( DEFAULT_VIEW );
	const { data, paginationInfo, isLoading, refresh } = useAdsData( view );
	const filterTerms = useFilterTerms();

	const fields = useMemo( () => getFields( filterTerms ), [ filterTerms ] );
	const actions = useMemo( () => getActions( { refresh } ), [ refresh ] );

	useHeaderActions(
		useMemo(
			() => [
				{
					type: 'primary',
					label: __( 'Add new newsletter ad', 'newspack-newsletters' ),
					href: `${ getAdminUrl() }post-new.php?post_type=${ ADS_CPT }`,
				},
			],
			[]
		)
	);

	return (
		<DataViews
			className="newspack-newsletters-list newspack-newsletters-ads-list"
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

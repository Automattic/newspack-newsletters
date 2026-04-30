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

// Walk every page of a REST collection and return the flat list. Used
// for the filter-term fetches below — `per_page` caps at 100 server-side,
// so a single request silently truncates on sites with many advertisers
// / placements and the filter dropdown ends up incomplete. Reads
// `X-WP-TotalPages` from the first response (parse: false to expose the
// Response object) and keeps requesting until exhausted. Network or
// shape errors fall back to whatever has been collected so the dropdown
// degrades to "best effort" rather than empty.
const TERMS_PER_PAGE = 100;

async function fetchAllTerms( basePath ) {
	const all = [];
	let page = 1;
	let totalPages = 1;
	while ( page <= totalPages ) {
		try {
			const response = await apiFetch( {
				path: `${ basePath }?per_page=${ TERMS_PER_PAGE }&_fields=id,name&page=${ page }`,
				parse: false,
			} );
			const data = await response.json();
			if ( ! Array.isArray( data ) ) {
				break;
			}
			all.push( ...data );
			if ( page === 1 ) {
				const headerPages = parseInt( response.headers?.get?.( 'X-WP-TotalPages' ) || '1', 10 );
				totalPages = Number.isFinite( headerPages ) && headerPages > 0 ? headerPages : 1;
			}
		} catch ( error ) {
			break;
		}
		page += 1;
	}
	return all;
}

// One-shot fetch for the taxonomy term sets that drive the Advertiser
// and Ad placement filter dropdowns. Paginates through every page so
// sites with many terms still get a complete dropdown.
function useFilterTerms() {
	const [ terms, setTerms ] = useState( { advertisers: [], placements: [] } );

	useEffect( () => {
		let cancelled = false;
		Promise.all( [ fetchAllTerms( '/wp/v2/newspack_nl_advertiser' ), fetchAllTerms( '/wp/v2/ad_placement' ) ] ).then(
			( [ advertisers, placements ] ) => {
				if ( cancelled ) {
					return;
				}
				setTerms( {
					advertisers: Array.isArray( advertisers ) ? advertisers : [],
					placements: Array.isArray( placements ) ? placements : [],
				} );
			}
		);
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

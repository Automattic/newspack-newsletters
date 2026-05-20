/**
 * Lightweight fetch of every advertiser term for the Modal's parent
 * picker — the DataView's paginated fetch would silently truncate the
 * picker on sites with more than one page of advertisers.
 */

import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';

const TAXONOMY_PATH = '/wp/v2/newspack_nl_advertiser';
// REST term collections cap `per_page` at 100 server-side; paginate
// until exhausted so sites with many advertisers still get the full
// graph.
const PER_PAGE = 100;

async function fetchAllAdvertisers() {
	const all = [];
	let page = 1;
	let totalPages = 1;
	while ( page <= totalPages ) {
		try {
			const response = await apiFetch( {
				path: `${ TAXONOMY_PATH }?per_page=${ PER_PAGE }&_fields=id,name,parent&page=${ page }`,
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
			// Network / shape errors fall back to whatever has been
			// collected — picker degrades to a partial tree rather than
			// blocking the modal entirely.
			break;
		}
		page += 1;
	}
	return all;
}

/**
 * @param {number} refreshKey Bump to refetch — wire to the screen's save trigger.
 * @return {Array} Flat term list `[{ id, name, parent }, …]`.
 */
export default function useAllAdvertisers( refreshKey = 0 ) {
	const [ advertisers, setAdvertisers ] = useState( [] );

	useEffect( () => {
		let cancelled = false;
		fetchAllAdvertisers().then( list => {
			if ( ! cancelled ) {
				setAdvertisers( list );
			}
		} );
		return () => {
			cancelled = true;
		};
	}, [ refreshKey ] );

	return advertisers;
}

/**
 * Fetch the option lists for the Newsletters list filter dropdowns.
 */

import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';

const CPT_SLUG = 'newspack_nl_cpt';

const PATHS = {
	authors: `/wp/v2/users?has_published_posts[]=${ CPT_SLUG }&per_page=100&context=view&_fields=id,name`,
	categories: '/wp/v2/categories?per_page=100&context=view&_fields=id,name',
	tags: '/wp/v2/tags?per_page=100&context=view&_fields=id,name',
	sendLists: '/newspack-newsletters/v1/newsletters-list/send-list-ids',
};

export default function useFilterElements() {
	const [ state, setState ] = useState( {
		authors: [],
		categories: [],
		tags: [],
		sendLists: [],
	} );

	useEffect( () => {
		let cancelled = false;
		const tryFetch = key =>
			apiFetch( { path: PATHS[ key ] } )
				.then( rows => ( cancelled ? null : { key, rows: Array.isArray( rows ) ? rows : [] } ) )
				.catch( () => null );

		Promise.all( Object.keys( PATHS ).map( tryFetch ) ).then( results => {
			if ( cancelled ) {
				return;
			}
			const patch = {};
			for ( const result of results ) {
				if ( result ) {
					patch[ result.key ] = result.rows;
				}
			}
			if ( Object.keys( patch ).length > 0 ) {
				setState( prev => ( { ...prev, ...patch } ) );
			}
		} );

		return () => {
			cancelled = true;
		};
	}, [] );

	return state;
}

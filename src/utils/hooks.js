/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { useState, useEffect } from '@wordpress/element';

/**
 * A React hook that provides tha layouts list,
 * both default and user-defined.
 *
 * @return {Array} Array of layouts
 */
export const useLayouts = () => {
	const [ isFetching, setIsFetching ] = useState( true );
	const [ layouts, setLayouts ] = useState( [] );

	useEffect(() => {
		apiFetch( {
			path: `/newspack-newsletters/v1/layouts`,
		} ).then( response => {
			setLayouts( response );
			setIsFetching( false );
		} );
	}, []);

	return { layouts, isFetchingLayouts: isFetching };
};

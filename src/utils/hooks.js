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
	const [ templates, setTemplates ] = useState( [] );

	useEffect(() => {
		apiFetch( {
			path: `/newspack-newsletters/v1/layouts`,
		} ).then( setTemplates );
	}, []);

	return templates;
};

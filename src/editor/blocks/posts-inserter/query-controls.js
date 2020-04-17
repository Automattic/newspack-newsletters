/**
 * External dependencies
 */
import { includes } from 'lodash';

/**
 * WordPress dependencies
 */
import { QueryControls } from '@wordpress/components';
import { addQueryArgs } from '@wordpress/url';
import { useState, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

// NOTE: Mostly copied from Gutenberg's Posts Inserter block.
// https://github.com/WordPress/gutenberg/blob/master/packages/block-library/src/posts-inserter/edit.js
const QueryControlsSettings = ( { attributes, setAttributes } ) => {
	const [ categoriesList, setCategoriesList ] = useState( [] );

	useEffect(() => {
		apiFetch( {
			path: addQueryArgs( `/wp/v2/categories`, {
				per_page: -1,
			} ),
		} ).then( setCategoriesList );
	}, []);

	const suggestions = categoriesList.reduce(
		( accumulator, category ) => ( {
			...accumulator,
			[ category.name ]: category,
		} ),
		{}
	);

	const categorySuggestions = categoriesList.reduce(
		( accumulator, category ) => ( {
			...accumulator,
			[ category.name ]: category,
		} ),
		{}
	);

	const selectCategories = tokens => {
		const hasNoSuggestion = tokens.some(
			token => typeof token === 'string' && ! suggestions[ token ]
		);
		if ( hasNoSuggestion ) {
			return;
		}
		// Categories that are already will be objects, while new additions will be strings (the name).
		// allCategories nomalizes the array so that they are all objects.
		const allCategories = tokens.map( token => {
			return typeof token === 'string' ? suggestions[ token ] : token;
		} );
		// We do nothing if the category is not selected
		// from suggestions.
		if ( includes( allCategories, null ) ) {
			return false;
		}
		setAttributes( { categories: allCategories } );
	};

	return (
		<QueryControls
			{ ...{ order: attributes.order, orderBy: attributes.orderBy } }
			numberOfItems={ attributes.postsToShow }
			onOrderChange={ value => setAttributes( { order: value } ) }
			onOrderByChange={ value => setAttributes( { orderBy: value } ) }
			onNumberOfItemsChange={ value => setAttributes( { postsToShow: value } ) }
			categorySuggestions={ categorySuggestions }
			onCategoryChange={ selectCategories }
			selectedCategories={ attributes.categories }
			// Support for legacy Gutenberg version.
			categoriesList={ [] }
			minItems={ 1 }
			maxItems={ 10 }
		/>
	);
};

export default QueryControlsSettings;

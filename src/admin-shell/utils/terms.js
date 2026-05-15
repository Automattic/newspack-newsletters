/**
 * Shared term/taxonomy helpers for DataView list screens and Quick Edit
 * panels. These deal with reading embedded terms off `_embedded.wp:term`,
 * paginating REST collections beyond the 100-item cap, and round-tripping
 * `FormTokenField` string tokens to `{id, name}` selections without
 * name-keyed maps (which collide on duplicate term names — possible on
 * hierarchical / custom taxonomies).
 */

import apiFetch from '@wordpress/api-fetch';

export const TERMS_PER_PAGE = 100;

// Walk every page of a REST collection and return the flat list. Used
// because `per_page` caps at 100 server-side, so a single request silently
// truncates on sites with many terms. Reads `X-WP-TotalPages` from the
// first response (parse: false to expose the Response object) and keeps
// requesting until exhausted. Network or shape errors fall back to
// whatever has been collected so callers degrade to "best effort" rather
// than empty.
export async function fetchAllTerms( basePath ) {
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

// Look up the `_embedded.wp:term` group whose terms belong to the
// requested taxonomy. Order is not guaranteed across post types, so a
// keyed lookup is safer than `terms[0]` / `terms[1]`.
export const termsForTaxonomy = ( item, taxonomy ) => {
	const groups = item?._embedded?.[ 'wp:term' ] || [];
	for ( const group of groups ) {
		if ( Array.isArray( group ) && group.length > 0 && group[ 0 ]?.taxonomy === taxonomy ) {
			return group;
		}
	}
	return [];
};

export const initialSelectionsForTaxonomy = ( item, taxonomy ) =>
	termsForTaxonomy( item, taxonomy )
		.map( term => ( { id: term?.id, name: term?.name } ) )
		.filter( s => typeof s.id === 'number' && s.name );

export const sortedIdsEqual = ( a, b ) => {
	if ( a.length !== b.length ) {
		return false;
	}
	// Numeric comparator — `Array.prototype.sort()` defaults to lexicographic
	// order, so `[2, 10]` would sort to `[10, 2]`. Set-equality still works
	// either way, but the numeric form removes ambiguity for future readers.
	const sa = a.map( s => s.id ).sort( ( x, y ) => x - y );
	const sb = b.map( s => s.id ).sort( ( x, y ) => x - y );
	return sa.every( ( v, i ) => v === sb[ i ] );
};

// Resolve user-typed tokens to `{id, name}` pairs by case-insensitive
// name match. Existing selections keep their ID across re-renders, so a
// user who picked one of two same-named terms stays on that one. New
// tokens (just-typed names) still resolve to the first matching option,
// so on hierarchical taxonomies that allow duplicate names — Categories
// being the only one we expose — a fresh pick can land on the "wrong"
// sibling. Acceptable trade-off vs. disambiguating every suggestion
// label; revisit if duplicate-name categories prove common in practice.
export const resolveTokens = ( newTokens, currentSelections, options ) =>
	newTokens
		.map( token => {
			const name = typeof token === 'string' ? token : token.value;
			const existing = currentSelections.find( s => s.name.toLowerCase() === String( name ).toLowerCase() );
			if ( existing ) {
				return existing;
			}
			const match = options.find( o => String( o.name ).toLowerCase() === String( name ).toLowerCase() );
			return match ? { id: match.id, name: match.name } : null;
		} )
		.filter( Boolean );

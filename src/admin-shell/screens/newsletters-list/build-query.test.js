import { buildQueryParams, toQueryString } from './build-query';

describe( 'buildQueryParams', () => {
	it( 'sets page and per_page from the view, defaulting to 1 and 25', () => {
		expect( buildQueryParams( {} ) ).toMatchObject( { page: 1, per_page: 25 } );
		expect( buildQueryParams( { page: 3, perPage: 50 } ) ).toMatchObject( {
			page: 3,
			per_page: 50,
		} );
	} );

	it( 'requests context=edit so meta and private fields are returned', () => {
		expect( buildQueryParams( {} ).context ).toBe( 'edit' );
	} );

	it( 'includes author and wp:term embeds for the columns that need them', () => {
		expect( buildQueryParams( {} )._embed ).toBe( 'author,wp:term' );
	} );

	it( 'defaults status to all common writable statuses (no trash) when no filter is set', () => {
		const { status } = buildQueryParams( {} );
		expect( status.split( ',' ) ).toEqual( expect.arrayContaining( [ 'publish', 'private', 'future', 'draft', 'pending' ] ) );
		expect( status.split( ',' ) ).not.toContain( 'trash' );
	} );

	it( 'replaces the default status set when the user filters by status', () => {
		const params = buildQueryParams( {
			filters: [ { field: 'status', operator: 'isAny', value: [ 'trash' ] } ],
		} );
		expect( params.status ).toBe( 'trash' );
	} );

	it( 'joins multi-value status filters with commas', () => {
		const params = buildQueryParams( {
			filters: [ { field: 'status', operator: 'isAny', value: [ 'publish', 'draft' ] } ],
		} );
		expect( params.status.split( ',' ) ).toEqual( [ 'publish', 'draft' ] );
	} );

	it( 'maps author filter to the REST author param', () => {
		const params = buildQueryParams( {
			filters: [ { field: 'author', value: 42 } ],
		} );
		expect( params.author ).toBe( '42' );
	} );

	it( 'ignores unknown filter fields silently rather than passing them through', () => {
		const params = buildQueryParams( {
			filters: [ { field: 'wat', value: 'nope' } ],
		} );
		expect( params ).not.toHaveProperty( 'wat' );
	} );

	it( 'maps view.sort.field=title to orderby=title', () => {
		const params = buildQueryParams( { sort: { field: 'title', direction: 'asc' } } );
		expect( params ).toMatchObject( { orderby: 'title', order: 'asc' } );
	} );

	it( 'maps view.sort.field=send_date to orderby=date (server-side sort by post_date)', () => {
		const params = buildQueryParams( { sort: { field: 'send_date', direction: 'desc' } } );
		expect( params ).toMatchObject( { orderby: 'date', order: 'desc' } );
	} );

	it( 'omits orderby for unknown sort fields (graceful degradation)', () => {
		const params = buildQueryParams( { sort: { field: 'wat', direction: 'asc' } } );
		expect( params ).not.toHaveProperty( 'orderby' );
	} );

	it( 'forwards the search term as the REST search param', () => {
		const params = buildQueryParams( { search: 'weekly digest' } );
		expect( params.search ).toBe( 'weekly digest' );
	} );

	it( 'omits the search param when the search string is empty', () => {
		expect( buildQueryParams( { search: '' } ) ).not.toHaveProperty( 'search' );
	} );
} );

describe( 'toQueryString', () => {
	it( 'serialises params into a leading-? query string', () => {
		const qs = toQueryString( { page: 2, status: 'publish,draft' } );
		expect( qs ).toMatch( /^\?/ );
		expect( qs ).toContain( 'page=2' );
		expect( qs ).toContain( 'status=publish%2Cdraft' );
	} );

	it( 'skips empty/undefined values', () => {
		const qs = toQueryString( { page: 1, search: '', author: undefined } );
		expect( qs ).not.toContain( 'search' );
		expect( qs ).not.toContain( 'author' );
	} );
} );

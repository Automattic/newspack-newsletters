import { getInitialFilters, getInitialView } from './initial-filters';

describe( 'getInitialFilters', () => {
	it( 'returns no filters when the URL has no post_status', () => {
		expect( getInitialFilters( '' ) ).toEqual( [] );
		expect( getInitialFilters( '?foo=bar' ) ).toEqual( [] );
	} );

	it( 'maps post_status=trash to the trash filter', () => {
		expect( getInitialFilters( '?post_status=trash' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'trash' ] } ] );
	} );

	it( 'maps post_status=draft, pending, and auto-draft to the combined draft filter', () => {
		const expected = [ { field: 'status', operator: 'isAny', value: [ 'draft,pending,auto-draft' ] } ];
		expect( getInitialFilters( '?post_status=draft' ) ).toEqual( expected );
		expect( getInitialFilters( '?post_status=pending' ) ).toEqual( expected );
		expect( getInitialFilters( '?post_status=auto-draft' ) ).toEqual( expected );
	} );

	it( 'maps post_status=future to the scheduled filter', () => {
		expect( getInitialFilters( '?post_status=future' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'future' ] } ] );
	} );

	it( 'maps post_status=publish and post_status=private to the combined sent filter', () => {
		// Both publish and private represent "Sent" in the field's elements,
		// keyed off the comma-joined value `'publish,private'`.
		expect( getInitialFilters( '?post_status=publish' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'publish,private' ] } ] );
		expect( getInitialFilters( '?post_status=private' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'publish,private' ] } ] );
	} );

	it( 'returns no filters for an unknown post_status value', () => {
		expect( getInitialFilters( '?post_status=garbage' ) ).toEqual( [] );
	} );

	it( 'preserves other query params and only reads post_status', () => {
		const filters = getInitialFilters( '?post_type=newspack_nl_cpt&post_status=trash&page=newspack-newsletters-list' );
		expect( filters ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'trash' ] } ] );
	} );
} );

describe( 'getInitialView', () => {
	it( 'returns an empty object when the URL has nothing to forward', () => {
		expect( getInitialView( '' ) ).toEqual( {} );
		expect( getInitialView( '?something=else' ) ).toEqual( {} );
	} );

	it( 'forwards the search term from `s`', () => {
		expect( getInitialView( '?s=weekly%20digest' ) ).toEqual( { search: 'weekly digest' } );
	} );

	it( 'maps `orderby=title&order=asc` to a sort patch', () => {
		expect( getInitialView( '?orderby=title&order=asc' ) ).toEqual( {
			sort: { field: 'title', direction: 'asc' },
		} );
	} );

	it( 'defaults sort direction to `desc` when `order` is missing or invalid', () => {
		expect( getInitialView( '?orderby=date' ) ).toEqual( {
			sort: { field: 'date', direction: 'desc' },
		} );
		expect( getInitialView( '?orderby=date&order=junk' ) ).toEqual( {
			sort: { field: 'date', direction: 'desc' },
		} );
	} );

	it( 'ignores unknown orderby fields rather than emitting a broken sort', () => {
		expect( getInitialView( '?orderby=wat&order=asc' ) ).toEqual( {} );
	} );

	it( 'combines filters, search, and sort when all are present', () => {
		const view = getInitialView( '?post_status=trash&s=draft%20test&orderby=author&order=asc' );
		expect( view ).toEqual( {
			filters: [ { field: 'status', operator: 'isAny', value: [ 'trash' ] } ],
			search: 'draft test',
			sort: { field: 'author', direction: 'asc' },
		} );
	} );
} );

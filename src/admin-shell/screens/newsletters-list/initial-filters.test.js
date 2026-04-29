import { getInitialFilters } from './initial-filters';

describe( 'getInitialFilters', () => {
	it( 'returns no filters when the URL has no post_status', () => {
		expect( getInitialFilters( '' ) ).toEqual( [] );
		expect( getInitialFilters( '?foo=bar' ) ).toEqual( [] );
	} );

	it( 'maps post_status=trash to the trash filter', () => {
		expect( getInitialFilters( '?post_status=trash' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'trash' ] } ] );
	} );

	it( 'maps post_status=draft and post_status=future to their dedicated filter values', () => {
		expect( getInitialFilters( '?post_status=draft' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'draft' ] } ] );
		expect( getInitialFilters( '?post_status=future' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'future' ] } ] );
	} );

	it( 'maps post_status=publish and post_status=private to the combined sent filter', () => {
		// Both publish and private represent "Sent" in the field's elements,
		// keyed off the comma-joined value `'publish,private'`.
		expect( getInitialFilters( '?post_status=publish' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'publish,private' ] } ] );
		expect( getInitialFilters( '?post_status=private' ) ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'publish,private' ] } ] );
	} );

	it( 'returns no filters for an unknown post_status value', () => {
		expect( getInitialFilters( '?post_status=pending' ) ).toEqual( [] );
		expect( getInitialFilters( '?post_status=garbage' ) ).toEqual( [] );
	} );

	it( 'preserves other query params and only reads post_status', () => {
		const filters = getInitialFilters( '?post_type=newspack_nl_cpt&post_status=trash&page=newspack-newsletters-list' );
		expect( filters ).toEqual( [ { field: 'status', operator: 'isAny', value: [ 'trash' ] } ] );
	} );
} );

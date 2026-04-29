import { resolveScreen, screens } from './index';

describe( 'admin-shell screen registry', () => {
	it( 'registers the Settings placeholder slug', () => {
		expect( Object.keys( screens ) ).toEqual( [ 'newspack-newsletters-settings' ] );
	} );

	it( 'each screen entry exposes a component and a label', () => {
		Object.values( screens ).forEach( entry => {
			expect( typeof entry.component ).toBe( 'function' );
			expect( typeof entry.label ).toBe( 'string' );
			expect( entry.label.length ).toBeGreaterThan( 0 );
		} );
	} );

	it( 'resolves a known slug to its registry entry', () => {
		expect( resolveScreen( 'newspack-newsletters-settings' ) ).toBe( screens[ 'newspack-newsletters-settings' ] );
	} );

	it( 'returns null for an unknown slug', () => {
		expect( resolveScreen( 'not-a-real-page' ) ).toBeNull();
	} );

	it( 'returns null for an empty slug', () => {
		expect( resolveScreen( '' ) ).toBeNull();
	} );
} );

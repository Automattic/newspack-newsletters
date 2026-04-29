import { resolveScreen, screens } from './index';

describe( 'admin-shell screen registry', () => {
	it( 'registers all four placeholder slugs', () => {
		expect( Object.keys( screens ).sort() ).toEqual(
			[ 'newspack-newsletters', 'newspack-newsletters-ads', 'newspack-newsletters-layouts', 'newspack-newsletters-settings' ].sort()
		);
	} );

	it( 'each screen entry exposes a component and a label', () => {
		Object.values( screens ).forEach( entry => {
			expect( typeof entry.component ).toBe( 'function' );
			expect( typeof entry.label ).toBe( 'string' );
			expect( entry.label.length ).toBeGreaterThan( 0 );
		} );
	} );

	it( 'resolves a known slug to its registry entry', () => {
		expect( resolveScreen( 'newspack-newsletters' ) ).toBe( screens[ 'newspack-newsletters' ] );
	} );

	it( 'returns null for an unknown slug', () => {
		expect( resolveScreen( 'not-a-real-page' ) ).toBeNull();
	} );

	it( 'returns null for an empty slug', () => {
		expect( resolveScreen( '' ) ).toBeNull();
	} );
} );

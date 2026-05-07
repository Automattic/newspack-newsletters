/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment jsdom
 */
/* eslint-enable jsdoc/check-tag-names */

describe( 'extension registry', () => {
	beforeEach( () => {
		// Reset modules so the registry's module-level state is fresh.
		jest.resetModules();
		delete window.newspack;
	} );

	it( 'registers and retrieves an extension', () => {
		const { registerLocalListModalExtension, getLocalListModalExtensions } = require( './extensions' );
		const ext = { render: () => 'a', onSave: jest.fn() };
		registerLocalListModalExtension( 'a', ext );
		expect( getLocalListModalExtensions() ).toEqual( [ ext ] );
	} );

	it( 'preserves registration order across multiple extensions', () => {
		const { registerLocalListModalExtension, getLocalListModalExtensions } = require( './extensions' );
		const a = { render: () => 'a' };
		const b = { render: () => 'b' };
		registerLocalListModalExtension( 'a', a );
		registerLocalListModalExtension( 'b', b );
		expect( getLocalListModalExtensions() ).toEqual( [ a, b ] );
	} );

	it( 'replaces an existing entry with a console.warn', () => {
		const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		const { registerLocalListModalExtension, getLocalListModalExtensions } = require( './extensions' );
		registerLocalListModalExtension( 'a', { render: () => 'first' } );
		registerLocalListModalExtension( 'a', { render: () => 'second' } );
		expect( warn ).toHaveBeenCalledWith( expect.stringContaining( 'a' ) );
		expect( getLocalListModalExtensions() ).toHaveLength( 1 );
		expect( getLocalListModalExtensions()[ 0 ].render() ).toBe( 'second' );
		warn.mockRestore();
	} );

	it( 'drains _pendingExtensions queue on first import', () => {
		window.newspack = { newsletters: { _pendingExtensions: [ [ 'pre', { render: () => 'pre' } ] ] } };
		const { getLocalListModalExtensions } = require( './extensions' );
		expect( getLocalListModalExtensions() ).toHaveLength( 1 );
		expect( window.newspack.newsletters._pendingExtensions ).toHaveLength( 0 );
	} );

	it( 'exposes registerLocalListModalExtension on window.newspack.newsletters for late registrations', () => {
		require( './extensions' );
		expect( typeof window.newspack.newsletters.registerLocalListModalExtension ).toBe( 'function' );
	} );
} );

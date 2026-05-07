import { boot } from './index';
import { EVENTS } from './events';

describe( 'wizard-bridge boot', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
		delete window.newspack_newsletters_wizard_bridge;
	} );

	it( 'no-ops when the localised global is missing', () => {
		boot();
		expect( document.body.querySelector( '.newspack-newsletters-wizard-bridge-root' ) ).toBeNull();
	} );

	it( 'mounts a single root container when the localised global is present', () => {
		window.newspack_newsletters_wizard_bridge = { debug: false };
		boot();
		const containers = document.body.querySelectorAll( '.newspack-newsletters-wizard-bridge-root' );
		expect( containers ).toHaveLength( 1 );
	} );

	it( 'is idempotent — second boot does not double-mount', () => {
		window.newspack_newsletters_wizard_bridge = { debug: false };
		boot();
		boot();
		expect( document.body.querySelectorAll( '.newspack-newsletters-wizard-bridge-root' ) ).toHaveLength( 1 );
	} );

	it( 'dispatches BRIDGE_MOUNTED on first successful mount', () => {
		window.newspack_newsletters_wizard_bridge = { debug: false };
		const listener = jest.fn();
		document.addEventListener( EVENTS.BRIDGE_MOUNTED, listener );
		boot();
		expect( listener ).toHaveBeenCalled();
		document.removeEventListener( EVENTS.BRIDGE_MOUNTED, listener );
	} );
} );

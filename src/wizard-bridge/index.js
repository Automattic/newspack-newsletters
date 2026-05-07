import './style.scss';
import './extensions';

import { render } from '@wordpress/element';

import LocalListModalHost from './local-list-modal-host';
import { EVENTS } from './events';

const ROOT_CLASS = 'newspack-newsletters-wizard-bridge-root';

export function boot() {
	if ( typeof document === 'undefined' ) {
		return;
	}
	if ( document.querySelector( `.${ ROOT_CLASS }` ) ) {
		return;
	}
	if ( ! window.newspack_newsletters_wizard_bridge ) {
		return;
	}
	const container = document.createElement( 'div' );
	container.className = ROOT_CLASS;
	document.body.appendChild( container );
	render( <LocalListModalHost />, container );
	document.dispatchEvent( new CustomEvent( EVENTS.BRIDGE_MOUNTED, { detail: {} } ) );
}

if ( typeof document !== 'undefined' ) {
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
}

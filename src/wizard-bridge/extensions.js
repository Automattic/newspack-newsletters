// The local-list-modal can render in two separate webpack entries
// (`wizard-bridge` and `admin-shell`). A module-local Map would give each
// bundle its own registry, so a registration made in one bundle would be
// invisible to the other. Stash the registry on `window` under a stable
// symbol-like key so both bundles read and write the same instance.
const REGISTRY_KEY = '__newspackNewslettersLocalListModalExtensions';

function getRegistry() {
	if ( typeof window === 'undefined' ) {
		// Tests or SSR contexts without a window — fall back to a per-call
		// Map. Production paths always have a window.
		return new Map();
	}
	if ( ! window[ REGISTRY_KEY ] ) {
		window[ REGISTRY_KEY ] = new Map();
	}
	return window[ REGISTRY_KEY ];
}

export function registerLocalListModalExtension( id, definition ) {
	const registry = getRegistry();
	if ( registry.has( id ) ) {
		// eslint-disable-next-line no-console
		console.warn( `[newspack-newsletters] Replacing local-list-modal extension "${ id }".` );
	}
	registry.set( id, definition );
}

export function getLocalListModalExtensions() {
	return Array.from( getRegistry().values() );
}

if ( typeof window !== 'undefined' ) {
	const np = ( window.newspack = window.newspack || {} );
	np.newsletters = np.newsletters || {};

	const pending = np.newsletters._pendingExtensions || [];
	pending.forEach( ( [ id, definition ] ) => registerLocalListModalExtension( id, definition ) );
	np.newsletters._pendingExtensions = [];

	np.newsletters.registerLocalListModalExtension = registerLocalListModalExtension;
}

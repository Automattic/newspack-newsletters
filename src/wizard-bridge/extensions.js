// Registry lives on `window` so both bundles that import this module
// (`wizard-bridge` + `admin-shell`) share one Map. A module-local Map
// would give each bundle its own copy and registrations made in one
// would be invisible to the other.
const REGISTRY_KEY = '__newspackNewslettersLocalListModalExtensions';

// Module-scoped fallback for SSR / non-jsdom environments — a fresh Map
// per call would silently drop every registration.
const FALLBACK_REGISTRY = new Map();

function getRegistry() {
	if ( typeof window === 'undefined' ) {
		return FALLBACK_REGISTRY;
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

// Default keeps pre-`appliesTo` extensions local-only.
const DEFAULT_APPLIES_TO = [ 'local' ];

function appliesToKind( definition, kind ) {
	const scope = Array.isArray( definition?.appliesTo ) && definition.appliesTo.length > 0 ? definition.appliesTo : DEFAULT_APPLIES_TO;
	return scope.includes( kind );
}

export function getLocalListModalExtensions( kind = 'local' ) {
	return Array.from( getRegistry().values() ).filter( ext => appliesToKind( ext, kind ) );
}

if ( typeof window !== 'undefined' ) {
	const np = ( window.newspack = window.newspack || {} );
	np.newsletters = np.newsletters || {};

	const pending = np.newsletters._pendingExtensions || [];
	pending.forEach( ( [ id, definition ] ) => registerLocalListModalExtension( id, definition ) );
	np.newsletters._pendingExtensions = [];

	np.newsletters.registerLocalListModalExtension = registerLocalListModalExtension;
}

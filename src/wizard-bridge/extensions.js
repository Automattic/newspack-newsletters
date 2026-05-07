const extensions = new Map();

export function registerLocalListModalExtension( id, definition ) {
	if ( extensions.has( id ) ) {
		// eslint-disable-next-line no-console
		console.warn( `[newspack-newsletters] Replacing local-list-modal extension "${ id }".` );
	}
	extensions.set( id, definition );
}

export function getLocalListModalExtensions() {
	return Array.from( extensions.values() );
}

const np = ( window.newspack = window.newspack || {} );
np.newsletters = np.newsletters || {};

const pending = np.newsletters._pendingExtensions || [];
pending.forEach( ( [ id, definition ] ) => registerLocalListModalExtension( id, definition ) );
np.newsletters._pendingExtensions = [];

np.newsletters.registerLocalListModalExtension = registerLocalListModalExtension;

/**
 * Admin shell entry point.
 *
 * Resolves the current admin page slug (provided by PHP via the
 * `newspackNewslettersAdmin` global) and mounts the matching screen
 * inside the page's React root container.
 *
 * @see Newspack\Newsletters\Admin\Admin_Shell
 */

import { createRoot } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';

import App from './app';
import { resolveLabel, resolveScreen } from './screens';
import './style.scss';

domReady( () => {
	const { mountId, currentPage } = window.newspackNewslettersAdmin || {};
	if ( ! mountId ) {
		return;
	}

	const target = document.getElementById( mountId );
	if ( ! target ) {
		return;
	}

	const entry = resolveScreen( currentPage );
	if ( ! entry ) {
		return;
	}

	// Prefer the PHP-localised label so the rendered heading/title stays
	// aligned with the admin menu label registered in PHP (see
	// `Admin_Shell::enqueue_assets`). Registry label is the fallback.
	createRoot( target ).render( <App label={ resolveLabel( currentPage ) } Screen={ entry.component } /> );
} );

/**
 * Chassis page header.
 *
 * Renders the action row populated via `useHeaderActions`. When
 * `newspack-plugin`'s admin-header chrome (the dark Newspack strip) is
 * present, the actions are portaled into its `__inner` flex container so
 * they sit alongside the breadcrumb. In standalone mode the actions
 * render above the screen content as a plain row.
 *
 * The portal target only exists after `newspack-plugin`'s React app has
 * mounted and rendered the strip's contents — we wait for it via a
 * `MutationObserver` rather than blocking on a fixed delay.
 */

import { Button } from '@wordpress/components';
import { createPortal, useEffect, useState } from '@wordpress/element';

import { useHeaderActionsValue } from './header-actions-context';

// Portal target is `.newspack-wizard__header`, the flex parent of `__inner`.
// Newspack-plugin's wizard mounts its primary actions as a SIBLING of `__inner`
// inside `__header` (see `packages/components/src/wizard/index.js`); matching
// that structure lets the existing flex layout do the alignment for us.
const NEWSPACK_HEADER_SELECTOR = '#newspack-wizards-admin-header .newspack-wizard__header';

const variantFor = type => ( 'primary' === type ? 'primary' : 'secondary' );

function useNewspackHeader() {
	const [ target, setTarget ] = useState( () => document.querySelector( NEWSPACK_HEADER_SELECTOR ) );

	useEffect( () => {
		if ( target ) {
			return undefined;
		}

		const wrapper = document.getElementById( 'newspack-wizards-admin-header' );
		if ( ! wrapper ) {
			return undefined;
		}

		// Newspack admin-header's React app rewrites this subtree on mount.
		// Watch for the slot to appear and capture it once.
		const observer = new MutationObserver( () => {
			const found = wrapper.querySelector( '.newspack-wizard__header' );
			if ( found ) {
				setTarget( found );
				observer.disconnect();
			}
		} );
		observer.observe( wrapper, { childList: true, subtree: true } );

		return () => observer.disconnect();
	}, [ target ] );

	return target;
}

function ActionButtons( { actions } ) {
	return (
		<>
			{ actions.map( ( action, index ) => (
				<Button
					key={ action.id || `${ action.label }-${ index }` }
					variant={ variantFor( action.type ) }
					icon={ action.icon }
					href={ action.href }
					onClick={ action.onClick }
				>
					{ action.label }
				</Button>
			) ) }
		</>
	);
}

export default function PageHeader() {
	const actions = useHeaderActionsValue();
	const newspackHeader = useNewspackHeader();

	if ( actions.length === 0 ) {
		return null;
	}

	if ( newspackHeader ) {
		// Reuse the wizard's `__header__actions` class so the host's existing
		// flex/spacing rules align our buttons next to the breadcrumb.
		return createPortal(
			<div className="newspack-wizard__header__actions newspack-newsletters-admin__header-actions--in-newspack-header">
				<ActionButtons actions={ actions } />
			</div>,
			newspackHeader
		);
	}

	// Standalone mode: render inline above the screen content.
	return (
		<div className="newspack-newsletters-admin__header-actions">
			<ActionButtons actions={ actions } />
		</div>
	);
}

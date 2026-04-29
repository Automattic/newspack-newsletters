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
import { useEffect, useState } from '@wordpress/element';
import { createPortal } from 'react-dom';

import { useHeaderActionsValue } from './header-actions-context';

const NEWSPACK_HEADER_INNER_SELECTOR = '#newspack-wizards-admin-header .newspack-wizard__header__inner';

const variantFor = type => ( 'primary' === type ? 'primary' : 'secondary' );

function useNewspackHeaderInner() {
	const [ target, setTarget ] = useState( () => document.querySelector( NEWSPACK_HEADER_INNER_SELECTOR ) );

	useEffect( () => {
		if ( target ) {
			return undefined;
		}

		const wrapper = document.getElementById( 'newspack-wizards-admin-header' );
		if ( ! wrapper ) {
			return undefined;
		}

		// Newspack admin-header's React app rewrites this subtree on mount.
		// Watch for the inner slot to appear and capture it once.
		const observer = new MutationObserver( () => {
			const found = wrapper.querySelector( '.newspack-wizard__header__inner' );
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
	const newspackHeaderInner = useNewspackHeaderInner();

	if ( actions.length === 0 ) {
		return null;
	}

	if ( newspackHeaderInner ) {
		return createPortal(
			<div className="newspack-newsletters-admin__header-actions newspack-newsletters-admin__header-actions--in-newspack-header">
				<ActionButtons actions={ actions } />
			</div>,
			newspackHeaderInner
		);
	}

	// Standalone mode: render inline above the screen content.
	return (
		<div className="newspack-newsletters-admin__header-actions">
			<ActionButtons actions={ actions } />
		</div>
	);
}

/**
 * Header actions context.
 *
 * Lets a screen register the action buttons that should appear in the
 * chassis header without coupling the screen to the chassis component
 * tree. Mirrors `newspack-plugin`'s wizard `setHeaderData({ actions })`
 * shape so the two surfaces are interchangeable down the line.
 *
 * Shape per action: `{ type: 'primary' | 'secondary', label, icon?, href?, onClick? }`
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from '@wordpress/element';

/**
 * Stable serialisation of an actions array for use as a useEffect dep.
 * Functions are skipped (they change identity every render), but
 * everything else that affects rendering — type, label, icon, href — is
 * included. Callers that care about stable handlers should memoise.
 */
function serialiseActions( actions ) {
	if ( ! Array.isArray( actions ) ) {
		return '[]';
	}
	return JSON.stringify(
		actions.map( action => ( {
			id: action?.id,
			type: action?.type,
			label: action?.label,
			href: action?.href,
			hasIcon: !! action?.icon,
			hasOnClick: typeof action?.onClick === 'function',
		} ) )
	);
}

const HeaderActionsContext = createContext( null );

export function HeaderActionsProvider( { children } ) {
	const [ actions, setActions ] = useState( [] );

	// `setActions` from useState is referentially stable; bundle it with the
	// latest actions array. Consumers that only need the setter avoid
	// re-rendering when actions change (no consumer today does, but cheap to
	// keep the contract clean).
	const value = useMemo( () => ( { actions, setActions } ), [ actions ] );

	return <HeaderActionsContext.Provider value={ value }>{ children }</HeaderActionsContext.Provider>;
}

/**
 * Read the currently-registered header actions. Used by the chassis
 * `<PageHeader />` component to render the action row.
 */
export function useHeaderActionsValue() {
	const ctx = useContext( HeaderActionsContext );
	return ctx ? ctx.actions : [];
}

/**
 * Register an array of header actions for the lifetime of the calling
 * component. Last writer wins, mirroring the wizard's setHeaderData
 * semantics. Outside a provider this is a no-op so screens can be
 * rendered in isolation (Jest, Storybook) without crashing.
 *
 * @param {Array} actions Array of action descriptors.
 */
export function useHeaderActions( actions ) {
	const ctx = useContext( HeaderActionsContext );
	const setActions = ctx ? ctx.setActions : null;

	// Hold the latest actions in a ref so the effect can read them
	// without making the (often-fresh) array literal a dep.
	const latestRef = useRef( actions );
	latestRef.current = actions;

	const dep = serialiseActions( actions );

	useEffect( () => {
		if ( ! setActions ) {
			return undefined;
		}
		const next = Array.isArray( latestRef.current ) ? latestRef.current : [];
		setActions( next );
		return () => setActions( [] );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ setActions, dep ] );
}

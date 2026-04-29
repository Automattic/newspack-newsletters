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

import { createContext, useContext, useEffect, useMemo, useState } from '@wordpress/element';

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
 * **Caller contract:** the `actions` array MUST be a stable reference
 * (wrap it in `useMemo`, with all closure-captured values listed in deps)
 * — same constraint newspack-plugin's `setHeaderData` already enforces.
 * Passing a fresh array literal every render would loop. In exchange,
 * any update to the array (including handler closures) propagates to
 * the rendered buttons immediately, so users always invoke the latest
 * `onClick` closure rather than a stale snapshot.
 *
 * @param {Array} actions Memoised array of action descriptors.
 */
export function useHeaderActions( actions ) {
	const ctx = useContext( HeaderActionsContext );
	const setActions = ctx ? ctx.setActions : null;

	useEffect( () => {
		if ( ! setActions ) {
			return undefined;
		}
		setActions( Array.isArray( actions ) ? actions : [] );
		return () => setActions( [] );
	}, [ setActions, actions ] );
}

/**
 * Header actions context.
 *
 * Lets a screen register the action buttons that should appear in the
 * chassis header without coupling the screen to the chassis component
 * tree. Mirrors `newspack-plugin`'s wizard `setHeaderData({ actions })`
 * shape so the two surfaces are interchangeable down the line.
 *
 * Shape per action: `{ type: 'primary' | 'secondary', label, icon?, href?, onClick? }`
 *
 * The context tracks an **owner-keyed registry** rather than a single
 * actions array. Each `useHeaderActions` caller gets a unique id (via
 * `useId`) and registers its own slot. The visible action set is the
 * most recently registered owner's; cleanup on unmount only removes
 * that owner's entry. Two screens that overlap briefly (e.g. during a
 * route transition or nested-view mount) no longer clobber each other:
 * the unmounting one cleans up its own slot, and any still-mounted
 * registration becomes (or remains) the visible owner.
 */

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from '@wordpress/element';

// Split contexts so registrations don't re-render readers and vice versa:
// `useHeaderActions` callers (screens) consume the stable API; `<PageHeader>` consumes the value.
const HeaderActionsAPIContext = createContext( null );
const HeaderActionsValueContext = createContext( [] );

export function HeaderActionsProvider( { children } ) {
	const [ registry, setRegistry ] = useState( () => ( {
		ownerOrder: [],
		actionsByOwner: {},
	} ) );

	const upsert = useCallback(
		( ownerId, actions ) =>
			setRegistry( prev => {
				const ownerOrder = prev.ownerOrder.includes( ownerId ) ? prev.ownerOrder : [ ...prev.ownerOrder, ownerId ];
				return {
					ownerOrder,
					actionsByOwner: { ...prev.actionsByOwner, [ ownerId ]: actions },
				};
			} ),
		[]
	);

	const remove = useCallback(
		ownerId =>
			setRegistry( prev => {
				if ( ! prev.ownerOrder.includes( ownerId ) ) {
					return prev;
				}
				const nextActionsByOwner = { ...prev.actionsByOwner };
				delete nextActionsByOwner[ ownerId ];
				return {
					ownerOrder: prev.ownerOrder.filter( id => id !== ownerId ),
					actionsByOwner: nextActionsByOwner,
				};
			} ),
		[]
	);

	const api = useMemo( () => ( { upsert, remove } ), [ upsert, remove ] );

	const visibleActions = useMemo( () => {
		const { ownerOrder, actionsByOwner } = registry;
		if ( ownerOrder.length === 0 ) {
			return [];
		}
		return actionsByOwner[ ownerOrder[ ownerOrder.length - 1 ] ] || [];
	}, [ registry ] );

	return (
		<HeaderActionsAPIContext.Provider value={ api }>
			<HeaderActionsValueContext.Provider value={ visibleActions }>{ children }</HeaderActionsValueContext.Provider>
		</HeaderActionsAPIContext.Provider>
	);
}

/**
 * Read the currently-registered header actions. Used by the chassis
 * `<PageHeader />` component to render the action row.
 */
export function useHeaderActionsValue() {
	return useContext( HeaderActionsValueContext );
}

/**
 * Register an array of header actions for the lifetime of the calling
 * component. Last writer wins (matches `setHeaderData` semantics), but
 * concurrent registrations don't clobber each other — each caller has
 * its own slot in the registry, removed on unmount only. Outside a
 * provider this is a no-op so screens can be rendered in isolation
 * (Jest, Storybook) without crashing.
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
	const api = useContext( HeaderActionsAPIContext );
	const ownerId = useId();

	useEffect( () => {
		if ( ! api ) {
			return undefined;
		}
		api.upsert( ownerId, Array.isArray( actions ) ? actions : [] );
		return () => api.remove( ownerId );
	}, [ api, ownerId, actions ] );
}

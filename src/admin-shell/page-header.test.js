/**
 * Tests for the chassis PageHeader + useHeaderActions hook.
 *
 * Action shape mirrors `newspack-plugin`'s wizard `setHeaderData` so a future
 * consolidation against the shared component package is mechanical:
 * `{ type: 'primary' | 'secondary', label, icon?, href?, onClick? }`.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import PageHeader from './page-header';
import { HeaderActionsProvider, useHeaderActions } from './header-actions-context';

const Harness = ( { actions } ) => {
	useHeaderActions( actions );
	return null;
};

const withProvider = ui => (
	<HeaderActionsProvider>
		<PageHeader />
		{ ui }
	</HeaderActionsProvider>
);

describe( 'PageHeader', () => {
	beforeEach( () => {
		// Each test starts without a Newspack admin-header in the DOM, so the
		// portal-fallback path renders inline. Tests that need the portal
		// target inject it explicitly (see "portals into newspack-plugin's
		// admin-header strip when present").
		document.getElementById( 'newspack-wizards-admin-header' )?.remove();
	} );

	it( 'renders nothing when no actions are registered', () => {
		const { container } = render( withProvider( null ) );
		expect( container.querySelector( '.newspack-newsletters-admin__header-actions' ) ).toBeNull();
		expect( screen.queryAllByRole( 'button' ) ).toHaveLength( 0 );
		expect( screen.queryAllByRole( 'link' ) ).toHaveLength( 0 );
	} );

	it( 'renders registered actions with their label', () => {
		const actions = [
			{ type: 'primary', label: 'Add new', onClick: jest.fn() },
			{ type: 'secondary', label: 'Help', href: 'https://example.test/help' },
		];
		render( withProvider( <Harness actions={ actions } /> ) );

		expect( screen.getByRole( 'button', { name: 'Add new' } ) ).toBeInTheDocument();
		expect( screen.getByRole( 'link', { name: 'Help' } ) ).toHaveAttribute( 'href', 'https://example.test/help' );
	} );

	it( 'fires onClick handlers when a primary action is activated', () => {
		const onClick = jest.fn();
		render( withProvider( <Harness actions={ [ { type: 'primary', label: 'Add new', onClick } ] } /> ) );

		fireEvent.click( screen.getByRole( 'button', { name: 'Add new' } ) );
		expect( onClick ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'clears the actions when the registering component unmounts', () => {
		const ConditionalHarness = ( { mounted } ) => ( mounted ? <Harness actions={ [ { type: 'primary', label: 'Add new' } ] } /> : null );

		const { rerender } = render( withProvider( <ConditionalHarness mounted /> ) );
		expect( screen.getByRole( 'button', { name: 'Add new' } ) ).toBeInTheDocument();

		rerender( withProvider( <ConditionalHarness mounted={ false } /> ) );
		expect( screen.queryByRole( 'button', { name: 'Add new' } ) ).not.toBeInTheDocument();
	} );

	it( 'lets the latest registering component own the action set', () => {
		const ScreenA = () => {
			useHeaderActions( [ { type: 'primary', label: 'Action A' } ] );
			return null;
		};
		const ScreenB = () => {
			useHeaderActions( [ { type: 'primary', label: 'Action B' } ] );
			return null;
		};

		const Switcher = ( { showB } ) => (
			<>
				<ScreenA />
				{ showB && <ScreenB /> }
			</>
		);

		const { rerender } = render( withProvider( <Switcher showB={ false } /> ) );
		expect( screen.getByRole( 'button', { name: 'Action A' } ) ).toBeInTheDocument();

		rerender( withProvider( <Switcher showB /> ) );
		// Last writer wins — matches newspack-plugin's setHeaderData semantics.
		expect( screen.getByRole( 'button', { name: 'Action B' } ) ).toBeInTheDocument();
		expect( screen.queryByRole( 'button', { name: 'Action A' } ) ).not.toBeInTheDocument();
	} );

	it( 'is a no-op when used outside a provider', () => {
		// Screens may be rendered outside the chassis (e.g. unit tests).
		// The hook should not throw; no actions should render.
		expect( () => {
			render( <Harness actions={ [ { type: 'primary', label: 'Add new' } ] } /> );
		} ).not.toThrow();
	} );

	it( "portals into newspack-plugin's admin-header strip when present", () => {
		// Stand up the same DOM newspack-plugin renders so the portal slot exists.
		const wrapper = document.createElement( 'div' );
		wrapper.id = 'newspack-wizards-admin-header';
		wrapper.innerHTML =
			'<div class="newspack-wizard__header"><div class="newspack-wizard__header__inner"><div class="newspack-wizard__title"><h2>Test</h2></div></div></div>';
		document.body.appendChild( wrapper );

		render( withProvider( <Harness actions={ [ { type: 'primary', label: 'Add new newsletter' } ] } /> ) );

		const portalled = wrapper.querySelector( '.newspack-newsletters-admin__header-actions--in-newspack-header' );
		expect( portalled ).not.toBeNull();
		expect( portalled.querySelector( 'button' ) ).toHaveTextContent( 'Add new newsletter' );
	} );
} );

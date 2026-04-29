import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './app';

const NoopScreen = () => <div data-testid="noop-screen">noop</div>;

describe( 'admin-shell App chrome', () => {
	it( 'mounts the provided screen component', () => {
		render( <App label="Layouts" Screen={ NoopScreen } /> );
		expect( screen.getByTestId( 'noop-screen' ) ).toBeInTheDocument();
	} );

	it( 'renders the chrome inside a main landmark region', () => {
		render( <App label="Settings" Screen={ NoopScreen } /> );
		expect( screen.getByRole( 'main' ) ).toBeInTheDocument();
	} );

	it( 'renders a screen-reader-only h1 with the page label for accessibility', () => {
		// The visible breadcrumb comes from newspack-plugin's admin chrome
		// (or is absent in standalone mode); the chassis still owns the
		// programmatic heading via `.screen-reader-text`.
		const { container } = render( <App label="Newsletters" Screen={ NoopScreen } /> );
		const heading = screen.getByRole( 'heading', { level: 1, name: 'Newsletters' } );
		expect( heading ).toBeInTheDocument();
		expect( heading ).toHaveClass( 'screen-reader-text' );
		expect( container.querySelector( 'h1.screen-reader-text' ) ).not.toBeNull();
	} );
} );

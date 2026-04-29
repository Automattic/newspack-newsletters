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

	it( 'does not render its own page heading — newspack-plugin admin chrome supplies the breadcrumb', () => {
		render( <App label="Newsletters" Screen={ NoopScreen } /> );
		expect( screen.queryByRole( 'heading', { name: 'Newsletters' } ) ).not.toBeInTheDocument();
	} );
} );

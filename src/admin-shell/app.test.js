import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './app';

const NoopScreen = () => <div data-testid="noop-screen">noop</div>;

describe( 'admin-shell App chrome', () => {
	it( 'renders the page label as the heading', () => {
		render( <App label="Newsletters" Screen={ NoopScreen } /> );
		expect( screen.getByRole( 'heading', { name: 'Newsletters' } ) ).toBeInTheDocument();
	} );

	it( 'mounts the provided screen component', () => {
		render( <App label="Layouts" Screen={ NoopScreen } /> );
		expect( screen.getByTestId( 'noop-screen' ) ).toBeInTheDocument();
	} );

	it( 'renders the chrome inside a main landmark region', () => {
		render( <App label="Settings" Screen={ NoopScreen } /> );
		expect( screen.getByRole( 'main' ) ).toBeInTheDocument();
	} );
} );

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import LocalListModal from './local-list-modal';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

describe( 'LocalListModal', () => {
	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'passes the saved list and mode to onSaved on create', async () => {
		const saved = { db_id: 42, title: 'New list', description: '', type: 'local' };
		apiFetch.mockImplementation( opts => {
			if ( opts.path === '/newspack-newsletters/v1/lists/audiences' ) {
				return Promise.resolve( { audiences: [], audience_label: 'List', help_before_save: '' } );
			}
			return Promise.resolve( saved );
		} );
		const onSaved = jest.fn();
		const onClose = jest.fn();
		render( <LocalListModal list={ null } onClose={ onClose } onSaved={ onSaved } /> );
		fireEvent.change( screen.getByLabelText( /List title/ ), { target: { value: 'New list' } } );
		fireEvent.click( screen.getByRole( 'button', { name: /^Add list$/ } ) );
		await waitFor( () => expect( onSaved ).toHaveBeenCalled() );
		expect( onSaved ).toHaveBeenCalledWith( { list: saved, mode: 'add' } );
	} );

	it( 'passes the saved list and mode to onSaved on edit', async () => {
		const list = { db_id: 9, title: 'Existing', description: '', audience: '', type: 'local' };
		const saved = { ...list, title: 'Renamed' };
		apiFetch.mockImplementation( opts => {
			if ( opts.path === '/newspack-newsletters/v1/lists/audiences' ) {
				return Promise.resolve( { audiences: [], audience_label: 'List', help_before_save: '' } );
			}
			return Promise.resolve( saved );
		} );
		const onSaved = jest.fn();
		render( <LocalListModal list={ list } onClose={ jest.fn() } onSaved={ onSaved } /> );
		fireEvent.change( screen.getByLabelText( /List title/ ), { target: { value: 'Renamed' } } );
		fireEvent.click( screen.getByRole( 'button', { name: /^Save changes$/ } ) );
		await waitFor( () => expect( onSaved ).toHaveBeenCalled() );
		expect( onSaved ).toHaveBeenCalledWith( { list: saved, mode: 'edit' } );
	} );
} );

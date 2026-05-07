import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import LocalListModalHost from './local-list-modal-host';
import { EVENTS } from './events';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

const dispatchEvent = ( name, detail ) => {
	document.dispatchEvent( new CustomEvent( name, { detail } ) );
};

describe( 'LocalListModalHost', () => {
	beforeEach( () => {
		apiFetch.mockReset();
		apiFetch.mockImplementation( opts => {
			if ( opts.path === '/newspack-newsletters/v1/lists/audiences' ) {
				return Promise.resolve( { audiences: [], audience_label: 'List', help_before_save: '' } );
			}
			return Promise.resolve( { db_id: 99, title: 'Created' } );
		} );
	} );

	it( 'mounts LocalListModal in add mode when OPEN_MODAL fires with mode=add', async () => {
		render( <LocalListModalHost /> );
		dispatchEvent( EVENTS.OPEN_MODAL, { mode: 'add' } );
		await waitFor( () => expect( screen.getByText( /Add new local list/ ) ).toBeInTheDocument() );
	} );

	it( 'mounts LocalListModal in edit mode pre-populated when OPEN_MODAL fires with mode=edit + list', async () => {
		render( <LocalListModalHost /> );
		const list = { db_id: 5, title: 'Existing', description: '', audience: '', type: 'local' };
		dispatchEvent( EVENTS.OPEN_MODAL, { mode: 'edit', list } );
		await waitFor( () => expect( screen.getByDisplayValue( 'Existing' ) ).toBeInTheDocument() );
	} );

	it( 'fires LOCAL_LIST_SAVED with detail after a successful save', async () => {
		render( <LocalListModalHost /> );
		const savedListener = jest.fn();
		document.addEventListener( EVENTS.LOCAL_LIST_SAVED, savedListener );
		dispatchEvent( EVENTS.OPEN_MODAL, { mode: 'add' } );
		await waitFor( () => expect( screen.getByLabelText( /List title/ ) ).toBeInTheDocument() );
		fireEvent.change( screen.getByLabelText( /List title/ ), { target: { value: 'Created' } } );
		fireEvent.click( screen.getByRole( 'button', { name: /^Add list$/ } ) );
		await waitFor( () => expect( savedListener ).toHaveBeenCalled() );
		const detail = savedListener.mock.calls[ 0 ][ 0 ].detail;
		expect( detail ).toEqual( expect.objectContaining( { listId: 99, mode: 'add', list: expect.objectContaining( { db_id: 99 } ) } ) );
		document.removeEventListener( EVENTS.LOCAL_LIST_SAVED, savedListener );
	} );

	it( 'mounts LocalListDeleteModal when OPEN_CONFIRM_DELETE fires', async () => {
		render( <LocalListModalHost /> );
		dispatchEvent( EVENTS.OPEN_CONFIRM_DELETE, { list: { db_id: 7, title: 'Doomed' } } );
		await waitFor( () => expect( screen.getByText( /Delete the local list "Doomed"/ ) ).toBeInTheDocument() );
	} );

	it( 'fires LOCAL_LIST_DELETED with detail after a successful DELETE', async () => {
		render( <LocalListModalHost /> );
		const deletedListener = jest.fn();
		document.addEventListener( EVENTS.LOCAL_LIST_DELETED, deletedListener );
		dispatchEvent( EVENTS.OPEN_CONFIRM_DELETE, { list: { db_id: 7, title: 'Doomed' } } );
		await waitFor( () => expect( screen.getByRole( 'button', { name: /^Delete list$/ } ) ).toBeInTheDocument() );
		fireEvent.click( screen.getByRole( 'button', { name: /^Delete list$/ } ) );
		await waitFor( () => expect( deletedListener ).toHaveBeenCalled() );
		expect( deletedListener.mock.calls[ 0 ][ 0 ].detail ).toEqual( { listId: 7 } );
		document.removeEventListener( EVENTS.LOCAL_LIST_DELETED, deletedListener );
	} );
} );

import apiFetch from '@wordpress/api-fetch';
import { dispatch } from '@wordpress/data';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import LocalListModal from '../admin-shell/screens/settings/local-list-modal';
import LocalListDeleteModal from '../admin-shell/screens/settings/local-list-delete-modal';
import { EVENTS } from './events';

export default function LocalListModalHost() {
	const [ modalState, setModalState ] = useState( null );
	const [ deletePending, setDeletePending ] = useState( null );
	const [ deletingId, setDeletingId ] = useState( null );

	const closeModal = useCallback( () => setModalState( null ), [] );
	const closeDelete = useCallback( () => setDeletePending( null ), [] );

	useEffect( () => {
		const handleOpen = event => {
			const { mode, list, kind } = event.detail || {};
			// ESP mode is edit-only and requires a row with a db_id; bail on malformed payloads instead of mounting a modal that would crash on submit.
			if ( kind === 'esp' ) {
				if ( ! list?.db_id ) {
					return;
				}
				setModalState( { mode: 'edit', list, kind: 'esp' } );
				return;
			}
			setModalState( {
				mode: mode || 'add',
				list: mode === 'edit' ? list : null,
				kind: 'local',
			} );
		};
		const handleConfirmDelete = event => {
			const list = event.detail?.list;
			if ( list ) {
				setDeletePending( list );
			}
		};
		document.addEventListener( EVENTS.OPEN_MODAL, handleOpen );
		document.addEventListener( EVENTS.OPEN_CONFIRM_DELETE, handleConfirmDelete );
		// Signal readiness only after the document listeners are installed.
		// A consumer reacting to `bridge-mounted` may synchronously dispatch
		// `open-local-list-modal` — its event must arrive at a ready listener.
		window.newspackNewslettersBridgeReady = true;
		document.dispatchEvent( new CustomEvent( EVENTS.BRIDGE_MOUNTED, { detail: {} } ) );
		return () => {
			document.removeEventListener( EVENTS.OPEN_MODAL, handleOpen );
			document.removeEventListener( EVENTS.OPEN_CONFIRM_DELETE, handleConfirmDelete );
		};
	}, [] );

	const handleSaved = useCallback( saved => {
		document.dispatchEvent(
			new CustomEvent( EVENTS.LOCAL_LIST_SAVED, {
				detail: { listId: saved?.list?.db_id, mode: saved?.mode, list: saved?.list, kind: saved?.kind },
			} )
		);
	}, [] );

	const confirmDelete = useCallback( async () => {
		if ( ! deletePending ) {
			return;
		}
		const list = deletePending;
		setDeletingId( list.db_id );
		try {
			await apiFetch( {
				path: `/newspack-newsletters/v1/lists/local/${ list.db_id }`,
				method: 'DELETE',
			} );
			document.dispatchEvent( new CustomEvent( EVENTS.LOCAL_LIST_DELETED, { detail: { listId: list.db_id } } ) );
			setDeletePending( null );
		} catch ( err ) {
			dispatch( noticesStore ).createErrorNotice( err?.message || __( 'Could not delete the local list.', 'newspack-newsletters' ), {
				type: 'snackbar',
				explicitDismiss: true,
			} );
		} finally {
			setDeletingId( null );
		}
	}, [ deletePending ] );

	return (
		<>
			{ modalState && (
				<LocalListModal
					key={ `${ modalState.mode }:${ modalState.kind }:${ modalState.list?.db_id || '' }` }
					list={ modalState.list }
					kind={ modalState.kind }
					onClose={ closeModal }
					onSaved={ handleSaved }
				/>
			) }
			{ deletePending && (
				<LocalListDeleteModal
					list={ deletePending }
					onConfirm={ confirmDelete }
					onCancel={ closeDelete }
					isBusy={ deletingId === deletePending.db_id }
				/>
			) }
		</>
	);
}

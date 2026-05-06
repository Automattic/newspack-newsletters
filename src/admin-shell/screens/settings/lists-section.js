import apiFetch from '@wordpress/api-fetch';
import {
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	Button,
	CheckboxControl,
	Modal,
	Notice,
	TextControl,
	TextareaControl,
} from '@wordpress/components';
import { dispatch } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import LocalListModal from './local-list-modal';

export default function ListsSection( { lists, isLoading, error, canAddLocal, onSave, onLocalListChanged, isSaving } ) {
	const [ workingCopy, setWorkingCopy ] = useState( lists || [] );
	// Ref (not state) so the merge effect below isn't re-triggered by edits.
	const dirtyIdsRef = useRef( new Set() );
	// `null` = closed, `'add'` = create modal, `<list>` = edit modal pre-populated.
	const [ modalState, setModalState ] = useState( null );
	const [ deletingId, setDeletingId ] = useState( null );
	const [ pendingDelete, setPendingDelete ] = useState( null );
	const closeModal = () => setModalState( null );
	const cancelDelete = () => setPendingDelete( null );

	const confirmDelete = async () => {
		if ( ! pendingDelete ) {
			return;
		}
		const list = pendingDelete;
		setDeletingId( list.db_id );
		try {
			await apiFetch( {
				path: `/newspack-newsletters/v1/lists/local/${ list.db_id }`,
				method: 'DELETE',
			} );
			if ( onLocalListChanged ) {
				onLocalListChanged();
			}
			setPendingDelete( null );
		} catch ( err ) {
			dispatch( noticesStore ).createErrorNotice( err?.message || __( 'Could not delete the local list.', 'newspack-newsletters' ), {
				type: 'snackbar',
				explicitDismiss: true,
			} );
			setPendingDelete( null );
		} finally {
			setDeletingId( null );
		}
	};

	useEffect( () => {
		// Preserve unsaved row edits when the parent reloads after local-list CRUD.
		// For local rows, only `active` is inline-owned — title/description/audience
		// come from the modal and must accept the refreshed values.
		const incoming = lists || [];
		setWorkingCopy( current => {
			if ( ! dirtyIdsRef.current.size ) {
				return incoming;
			}
			return incoming.map( row => {
				if ( ! dirtyIdsRef.current.has( row.id ) ) {
					return row;
				}
				const dirty = current.find( c => c.id === row.id );
				if ( ! dirty ) {
					return row;
				}
				if ( row.type === 'local' ) {
					return { ...row, active: dirty.active };
				}
				return dirty;
			} );
		} );
	}, [ lists ] );

	const updateRow = ( id, patch ) => {
		setWorkingCopy( current => current.map( row => ( row.id === id ? { ...row, ...patch } : row ) ) );
		dirtyIdsRef.current.add( id );
	};

	const handleSave = async () => {
		try {
			await onSave( workingCopy );
			dirtyIdsRef.current = new Set();
		} catch {
			// Parent surfaced the error notice; keep dirty tracking so a reload doesn't drop edits.
		}
	};

	if ( error ) {
		return (
			<div className="newspack-newsletters-settings__section">
				<h2>{ __( 'Subscription lists', 'newspack-newsletters' ) }</h2>
				<Notice status="error" isDismissible={ false }>
					{ error?.message || __( 'Could not load lists from the configured provider.', 'newspack-newsletters' ) }
				</Notice>
			</div>
		);
	}

	if ( isLoading ) {
		return (
			<div className="newspack-newsletters-settings__section">
				<h2>{ __( 'Subscription lists', 'newspack-newsletters' ) }</h2>
				<p>{ __( 'Loading lists…', 'newspack-newsletters' ) }</p>
			</div>
		);
	}

	if ( ! workingCopy.length ) {
		return (
			<div className="newspack-newsletters-settings__section">
				<h2>{ __( 'Subscription lists', 'newspack-newsletters' ) }</h2>
				<p>
					{ __(
						'No lists found for the configured provider yet. Save provider settings first if you have just connected.',
						'newspack-newsletters'
					) }
				</p>
				{ canAddLocal && (
					<>
						<HStack justify="flex-start" spacing={ 2 } expanded={ false }>
							<Button variant="secondary" onClick={ () => setModalState( 'add' ) }>
								{ __( 'Add new local list', 'newspack-newsletters' ) }
							</Button>
						</HStack>
						{ modalState && (
							<LocalListModal list={ modalState === 'add' ? null : modalState } onClose={ closeModal } onSaved={ onLocalListChanged } />
						) }
					</>
				) }
			</div>
		);
	}

	return (
		<div className="newspack-newsletters-settings__section">
			<h2>{ __( 'Subscription lists', 'newspack-newsletters' ) }</h2>
			<p>{ __( 'Manage which lists are available for subscription.', 'newspack-newsletters' ) }</p>

			<div className="newspack-newsletters-settings__lists">
				{ workingCopy.map( list => {
					const isLocal = list.type === 'local';
					const needsAudience = isLocal && ! list.audience;
					return (
						<VStack key={ list.id } spacing={ 2 } className="newspack-newsletters-settings__list-row">
							<CheckboxControl
								label={ list.remote_name || list.name || list.title || __( '(unnamed list)', 'newspack-newsletters' ) }
								checked={ !! list.active && ! needsAudience }
								onChange={ next => updateRow( list.id, { active: next } ) }
								help={
									needsAudience
										? __( 'Configure an audience to enable subscriptions.', 'newspack-newsletters' )
										: list.type_label || ''
								}
								disabled={ needsAudience }
								__nextHasNoMarginBottom
							/>
							{ ! isLocal ? (
								<>
									<TextControl
										label={ __( 'List title', 'newspack-newsletters' ) }
										value={ list.title || '' }
										onChange={ next => updateRow( list.id, { title: next } ) }
										__nextHasNoMarginBottom
										__next40pxDefaultSize
									/>
									<TextareaControl
										label={ __( 'List description', 'newspack-newsletters' ) }
										value={ list.description || '' }
										onChange={ next => updateRow( list.id, { description: next } ) }
										__nextHasNoMarginBottom
									/>
								</>
							) : (
								<HStack justify="flex-start" spacing={ 2 } expanded={ false }>
									<Button variant="link" onClick={ () => setModalState( list ) } disabled={ deletingId === list.db_id }>
										{ __( 'Edit', 'newspack-newsletters' ) }
									</Button>
									<Button
										variant="link"
										isDestructive
										onClick={ () => setPendingDelete( list ) }
										isBusy={ deletingId === list.db_id }
										disabled={ deletingId === list.db_id }
									>
										{ __( 'Delete', 'newspack-newsletters' ) }
									</Button>
								</HStack>
							) }
						</VStack>
					);
				} ) }
			</div>

			<HStack justify="flex-start" spacing={ 2 } expanded={ false }>
				<Button variant="primary" onClick={ handleSave } isBusy={ isSaving } disabled={ isSaving }>
					{ __( 'Save subscription lists', 'newspack-newsletters' ) }
				</Button>
				{ canAddLocal && (
					<Button variant="secondary" onClick={ () => setModalState( 'add' ) }>
						{ __( 'Add new local list', 'newspack-newsletters' ) }
					</Button>
				) }
			</HStack>

			{ modalState && (
				<LocalListModal list={ modalState === 'add' ? null : modalState } onClose={ closeModal } onSaved={ onLocalListChanged } />
			) }

			{ pendingDelete && (
				<Modal
					title={ __( 'Delete local list', 'newspack-newsletters' ) }
					onRequestClose={ cancelDelete }
					size="small"
					className="newspack-newsletters-local-list-delete-modal"
				>
					<VStack spacing={ 4 }>
						<p>
							{ sprintf(
								// translators: %s is the title of the local list being deleted.
								__( 'Delete the local list "%s"? This cannot be undone.', 'newspack-newsletters' ),
								pendingDelete.title
							) }
						</p>
						<HStack justify="flex-end" spacing={ 2 }>
							<Button variant="tertiary" onClick={ cancelDelete } disabled={ deletingId === pendingDelete.db_id }>
								{ __( 'Cancel', 'newspack-newsletters' ) }
							</Button>
							<Button
								variant="primary"
								isDestructive
								onClick={ confirmDelete }
								isBusy={ deletingId === pendingDelete.db_id }
								disabled={ deletingId === pendingDelete.db_id }
							>
								{ __( 'Delete list', 'newspack-newsletters' ) }
							</Button>
						</HStack>
					</VStack>
				</Modal>
			) }
		</div>
	);
}

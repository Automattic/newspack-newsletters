import {
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	Button,
	CheckboxControl,
	Notice,
	TextControl,
	TextareaControl,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import LocalListModal from './local-list-modal';

export default function ListsSection( { lists, isLoading, error, canAddLocal, onSave, onLocalListCreated, isSaving } ) {
	const [ workingCopy, setWorkingCopy ] = useState( lists || [] );
	// `null` = closed, `'add'` = create modal, `<list>` = edit modal pre-populated.
	const [ modalState, setModalState ] = useState( null );
	const closeModal = () => setModalState( null );

	useEffect( () => {
		setWorkingCopy( lists || [] );
	}, [ lists ] );

	const updateRow = ( id, patch ) => {
		setWorkingCopy( current => current.map( row => ( row.id === id ? { ...row, ...patch } : row ) ) );
	};

	const handleSave = async () => {
		await onSave( workingCopy );
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
							<LocalListModal list={ modalState === 'add' ? null : modalState } onClose={ closeModal } onSaved={ onLocalListCreated } />
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
					return (
						<VStack key={ list.id } spacing={ 2 } className="newspack-newsletters-settings__list-row">
							<CheckboxControl
								label={ list.remote_name || list.name || list.title || __( '(unnamed list)', 'newspack-newsletters' ) }
								checked={ !! list.active }
								onChange={ next => updateRow( list.id, { active: next } ) }
								help={ list.type_label || '' }
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
									<Button variant="link" onClick={ () => setModalState( list ) }>
										{ __( 'Edit', 'newspack-newsletters' ) }
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
				<LocalListModal list={ modalState === 'add' ? null : modalState } onClose={ closeModal } onSaved={ onLocalListCreated } />
			) }
		</div>
	);
}

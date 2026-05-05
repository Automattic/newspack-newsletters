import { Button, CheckboxControl, Notice, TextControl, TextareaControl } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export default function ListsSection( { lists, isLoading, error, onSave, isSaving } ) {
	const [ workingCopy, setWorkingCopy ] = useState( lists || [] );

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
						<div key={ list.id } className="newspack-newsletters-settings__list-row">
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
								<p className="newspack-newsletters-settings__list-local-meta">
									<strong>{ list.title }</strong>
									{ list.description && <span> — { list.description }</span> }
									{ list.edit_link && (
										<>
											{ ' — ' }
											<a href={ list.edit_link }>{ __( 'Edit', 'newspack-newsletters' ) }</a>
										</>
									) }
								</p>
							) }
						</div>
					);
				} ) }
			</div>

			<Button variant="primary" onClick={ handleSave } isBusy={ isSaving } disabled={ isSaving }>
				{ __( 'Save subscription lists', 'newspack-newsletters' ) }
			</Button>
		</div>
	);
}

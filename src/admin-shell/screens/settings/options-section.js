import { Button, CheckboxControl, TextControl } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export default function OptionsSection( { title, options, schema, activeProvider, onSave, isSaving } ) {
	const [ values, setValues ] = useState( options || {} );

	useEffect( () => {
		setValues( options || {} );
	}, [ options ] );

	const updateValue = ( key, value ) => {
		setValues( current => ( { ...current, [ key ]: value } ) );
	};

	const handleSave = async () => {
		// Submit only the keys this section owns so a save in one card
		// doesn't accidentally write the other card's working copy.
		const subset = {};
		( schema || [] ).forEach( field => {
			if ( field.provider && field.provider !== activeProvider ) {
				return;
			}
			if ( values && Object.prototype.hasOwnProperty.call( values, field.key ) ) {
				subset[ field.key ] = values[ field.key ];
			}
		} );
		await onSave( { options: subset } );
	};

	const heading = title || __( 'Newsletter options', 'newspack-newsletters' );

	return (
		<div className="newspack-newsletters-settings__section">
			<h2>{ heading }</h2>

			{ ( schema || [] ).map( field => {
				if ( field.provider && field.provider !== activeProvider ) {
					return null;
				}
				const value = values?.[ field.key ];
				if ( field.type === 'checkbox' ) {
					return (
						<CheckboxControl
							key={ field.key }
							label={ field.label }
							checked={ !! value }
							onChange={ next => updateValue( field.key, next ) }
							__nextHasNoMarginBottom
						/>
					);
				}
				return (
					<TextControl
						key={ field.key }
						label={ field.label }
						value={ value ?? '' }
						placeholder={ field.placeholder || '' }
						help={
							field.help && field.help_url ? (
								<a href={ field.help_url } target="_blank" rel="noreferrer noopener">
									{ field.help }
								</a>
							) : (
								field.help || ''
							)
						}
						onChange={ next => updateValue( field.key, next ) }
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
				);
			} ) }

			<Button variant="primary" onClick={ handleSave } isBusy={ isSaving } disabled={ isSaving }>
				{ __( 'Save options', 'newspack-newsletters' ) }
			</Button>
		</div>
	);
}

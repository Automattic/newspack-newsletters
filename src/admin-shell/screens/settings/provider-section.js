import { Button, Notice, SelectControl, TextControl } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { getProviderCredentialFields } from './provider-credentials-schema';

export default function ProviderSection( { provider, providers, onSave, isSaving } ) {
	const [ slug, setSlug ] = useState( provider?.selected || '' );
	const [ credentials, setCredentials ] = useState( provider?.credentials || {} );

	useEffect( () => {
		setSlug( provider?.selected || '' );
		setCredentials( provider?.credentials || {} );
	}, [ provider ] );

	const fields = getProviderCredentialFields( slug );
	const isManual = slug === 'manual';

	const updateCredential = ( key, value ) => {
		setCredentials( current => ( { ...current, [ key ]: value } ) );
	};

	const handleSave = async () => {
		const payload = { provider: { slug } };
		if ( ! isManual ) {
			payload.provider.credentials = credentials;
		}
		await onSave( payload );
	};

	const oauth = provider?.oauth;
	const showOAuthNotice = !! oauth && ! oauth.valid && oauth.auth_url;

	return (
		<div className="newspack-newsletters-settings__section">
			<h2>{ __( 'Service provider', 'newspack-newsletters' ) }</h2>

			{ showOAuthNotice && (
				<Notice status="warning" isDismissible={ false }>
					<p>{ __( 'Authorize this site to connect to the configured provider.', 'newspack-newsletters' ) }</p>
					<p>
						<Button variant="primary" href={ oauth.auth_url }>
							{ __( 'Authorize', 'newspack-newsletters' ) }
						</Button>
					</p>
				</Notice>
			) }

			<SelectControl
				label={ __( 'Service Provider', 'newspack-newsletters' ) }
				value={ slug }
				options={ ( providers || [] ).map( option => ( {
					label: option.name,
					value: option.slug,
				} ) ) }
				onChange={ next => {
					setSlug( next );
					setCredentials( {} );
				} }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>

			{ ! isManual && fields.length > 0 && (
				<div className="newspack-newsletters-settings__credentials">
					{ fields.map( field => (
						<TextControl
							key={ field.key }
							label={ field.label }
							value={ credentials?.[ field.key ] || '' }
							placeholder={ field.placeholder || '' }
							help={
								field.help && field.helpURL ? (
									<a href={ field.helpURL } target="_blank" rel="noreferrer noopener">
										{ field.help }
									</a>
								) : (
									field.help || ''
								)
							}
							onChange={ value => updateCredential( field.key, value ) }
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
					) ) }
				</div>
			) }

			<Button variant="primary" onClick={ handleSave } isBusy={ isSaving } disabled={ isSaving }>
				{ __( 'Save provider settings', 'newspack-newsletters' ) }
			</Button>
		</div>
	);
}

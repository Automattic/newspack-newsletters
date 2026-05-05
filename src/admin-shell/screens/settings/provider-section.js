import { Button, Notice, SelectControl, TextControl } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { getProviderCredentialFields } from './provider-credentials-schema';

export default function ProviderSection( { provider, providers, onSave, onAuthorized, isSaving } ) {
	const [ slug, setSlug ] = useState( provider?.selected || '' );
	const [ credentialEdits, setCredentialEdits ] = useState( {} );

	// Resync edits to the upstream provider state — clear the local
	// working copy whenever a save returns a refreshed payload (so the
	// "(set; leave blank to keep)" placeholder shows again instead of the
	// just-typed value), or when a provider switch reshuffles the fields.
	useEffect( () => {
		setSlug( provider?.selected || '' );
		setCredentialEdits( {} );
	}, [ provider ] );

	const fields = getProviderCredentialFields( slug );
	const isManual = slug === 'manual';
	// Only trust the saved `credentials_set` flags when the local selector
	// still matches the saved provider — otherwise the field keys can
	// overlap (e.g. both Mailchimp and Constant Contact use `api_key`) and
	// the placeholder would lie about whether the new provider has stored
	// credentials.
	const credentialsSet = slug === ( provider?.selected || '' ) ? provider?.credentials_set || {} : {};

	const updateCredential = ( key, value ) => {
		setCredentialEdits( current => ( { ...current, [ key ]: value } ) );
	};

	const handleSave = async () => {
		const payload = { provider: { slug } };
		if ( ! isManual ) {
			// Only post the fields the user actually typed into. The server
			// merges these with the existing stored values so empty fields
			// don't wipe out the parts of the credentials block the user
			// didn't touch.
			const submitted = {};
			fields.forEach( field => {
				const value = credentialEdits[ field.key ];
				if ( typeof value === 'string' && value.length > 0 ) {
					submitted[ field.key ] = value;
				}
			} );
			payload.provider.credentials = submitted;
		}
		await onSave( payload );
	};

	const oauth = provider?.oauth;
	const showOAuthNotice = !! oauth && ! oauth.valid && oauth.auth_url;

	const handleAuthorize = () => {
		// Open `about:blank` first so the popup stays same-origin while
		// we install the minimal `{ verify }` opener; only then navigate
		// to the OAuth provider. If `auth_url` ever resolved to a third-
		// party origin, this prevents it from briefly seeing the parent
		// window's full `window.opener` reference.
		const authWindow = window.open( 'about:blank', 'newspack_newsletters_oauth', 'width=500,height=600' );
		if ( ! authWindow ) {
			return;
		}
		let verified = false;
		authWindow.opener = {
			verify: () => {
				if ( verified ) {
					return;
				}
				verified = true;
				if ( typeof onAuthorized === 'function' ) {
					onAuthorized();
				}
			},
		};
		authWindow.location = oauth.auth_url;
	};

	return (
		<div className="newspack-newsletters-settings__section">
			<h2>{ __( 'Service provider', 'newspack-newsletters' ) }</h2>

			{ showOAuthNotice && (
				<Notice status="warning" isDismissible={ false }>
					<p>{ __( 'Authorize this site to connect to the configured provider.', 'newspack-newsletters' ) }</p>
					<p>
						<Button variant="primary" onClick={ handleAuthorize }>
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
					setCredentialEdits( {} );
				} }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>

			{ ! isManual && fields.length > 0 && (
				<div className="newspack-newsletters-settings__credentials">
					{ fields.map( field => {
						const isSet = !! credentialsSet[ field.key ];
						const placeholder = isSet ? __( 'Set — enter a new value to replace.', 'newspack-newsletters' ) : field.placeholder || '';
						const help =
							field.help && field.helpURL ? (
								<a href={ field.helpURL } target="_blank" rel="noreferrer noopener">
									{ field.help }
								</a>
							) : (
								field.help || ''
							);
						return (
							<TextControl
								key={ field.key }
								label={ field.label }
								value={ credentialEdits[ field.key ] || '' }
								placeholder={ placeholder }
								help={ help }
								onChange={ value => updateCredential( field.key, value ) }
								__nextHasNoMarginBottom
								__next40pxDefaultSize
							/>
						);
					} ) }
				</div>
			) }

			<Button variant="primary" onClick={ handleSave } isBusy={ isSaving } disabled={ isSaving }>
				{ __( 'Save provider settings', 'newspack-newsletters' ) }
			</Button>
		</div>
	);
}

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { Button, ExternalLink, Spinner, TextControl } from '@wordpress/components';
import { Fragment, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { ENTER } from '@wordpress/keycodes';

export default ( { onSetupStatus } ) => {
	const [ keys, setKeys ] = useState( {} );
	const [ inFlight, setInFlight ] = useState( false );
	const [ errors, setErrors ] = useState( {} );
	const commitSettings = () => {
		setInFlight( true );
		setErrors( {} );
		apiFetch( {
			path: '/newspack-newsletters/v1/keys',
			method: 'POST',
			data: keys,
		} )
			.then( results => {
				setInFlight( false );
				setKeys( results );
				onSetupStatus( results.status );
			} )
			.catch( handleErrors );
	};
	const handleErrors = error => {
		const allErrors = { [ error.code ]: error.message };
		( error.additional_errors || [] ).forEach(
			additionalError => ( allErrors[ additionalError.code ] = additionalError.message )
		);
		setErrors( allErrors );
		setInFlight( false );
	};
	useEffect(() => {
		setInFlight( true );
		apiFetch( { path: `/newspack-newsletters/v1/keys` } )
			.then( results => {
				setInFlight( false );
				setKeys( results );
				onSetupStatus( results.status );
			} )
			.catch( handleErrors );
	}, []);

	const {
		mailchimp_api_key: mailchimpAPIKey = '',
		mjml_api_key: mjmlApplicationId = '',
		mjml_api_secret: mjmlAPISecret = '',
	} = keys;
	return (
		<Fragment>
			<div className="newspack-newsletters-modal__content">
				<div>
					<h4>{ __( 'Enter your Mailchimp API key', 'newspack-newsletters' ) }</h4>
					{ errors.newspack_newsletters_invalid_keys_mailchimp && (
						<p className="error">{ errors.newspack_newsletters_invalid_keys_mailchimp }</p>
					) }
					<TextControl
						label={ __( 'Mailchimp API Key', 'newspack-newsletters' ) }
						value={ mailchimpAPIKey }
						onChange={ value => setKeys( { ...keys, mailchimp_api_key: value } ) }
						disabled={ inFlight }
						onKeyDown={ event => {
							if ( ENTER === event.keyCode ) {
								event.preventDefault();
								commitSettings();
							}
						} }
					/>
					{ inFlight && <Spinner /> }
					<ExternalLink href="https://mailchimp.com/help/about-api-keys/">
						{ __( 'About Mailchimp API keys', 'newspack-newsletters' ) }
					</ExternalLink>
					<h4>{ __( 'Enter your MJML API keys', 'newspack-newsletters' ) }</h4>
					{ errors.newspack_newsletters_invalid_keys_mjml && (
						<p className="error">{ errors.newspack_newsletters_invalid_keys_mjml }</p>
					) }
					<TextControl
						label={ __( 'MJML Application ID', 'newspack-newsletters' ) }
						value={ mjmlApplicationId }
						onChange={ value => setKeys( { ...keys, mjml_api_key: value } ) }
						disabled={ inFlight }
						onKeyDown={ event => {
							if ( ENTER === event.keyCode ) {
								event.preventDefault();
								commitSettings();
							}
						} }
					/>
					{ inFlight && <Spinner /> }
					<TextControl
						label={ __( 'MJML Secret Key', 'newspack-newsletters' ) }
						value={ mjmlAPISecret }
						onChange={ value => setKeys( { ...keys, mjml_api_secret: value } ) }
						disabled={ inFlight }
						onKeyDown={ event => {
							if ( ENTER === event.keyCode ) {
								event.preventDefault();
								commitSettings();
							}
						} }
					/>
					{ inFlight && <Spinner /> }
					<ExternalLink href="https://mjml.io/api">
						{ __( 'Request MJML API keys', 'newspack-newsletters' ) }
					</ExternalLink>
				</div>
			</div>
			<Button isPrimary onClick={ commitSettings }>
				{ __( 'Save Settings', 'newspack-newsletter' ) }
			</Button>
		</Fragment>
	);
};

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { Button, ExternalLink, TextControl } from '@wordpress/components';
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
	const canSubmit =
		mailchimpAPIKey.length > 0 && mjmlApplicationId.length > 0 && mjmlAPISecret.length > 0;
	return (
		<Fragment>
			<div className="newspack-newsletters-modal__content newspack-newsletters-modal__settings">
				<div className="newspack-newsletters-modal__settings-wrapper">
					<h4>{ __( 'Enter your Mailchimp API key', 'newspack-newsletters' ) }</h4>
					<TextControl
						label={ __( 'Mailchimp API key', 'newspack-newsletters' ) }
						value={ mailchimpAPIKey }
						onChange={ value => setKeys( { ...keys, mailchimp_api_key: value } ) }
						disabled={ inFlight }
						onKeyDown={ event => {
							if ( canSubmit && ENTER === event.keyCode ) {
								event.preventDefault();
								commitSettings();
							}
						} }
						className={ errors.newspack_newsletters_invalid_keys_mailchimp && 'has-error' }
					/>
					{ errors.newspack_newsletters_invalid_keys_mailchimp && (
						<p className="error">{ errors.newspack_newsletters_invalid_keys_mailchimp }</p>
					) }
					<p>
						<ExternalLink href="https://us1.admin.mailchimp.com/account/api/">
							{ __( 'Generate Mailchimp API key', 'newspack-newsletters' ) }
						</ExternalLink>
						<span className="separator"> | </span>
						<ExternalLink href="https://mailchimp.com/help/about-api-keys/">
							{ __( 'About Mailchimp API keys', 'newspack-newsletters' ) }
						</ExternalLink>
					</p>
					<hr />
					<h4>{ __( 'Enter your MJML API keys', 'newspack-newsletters' ) }</h4>
					<TextControl
						label={ __( 'MJML application ID', 'newspack-newsletters' ) }
						value={ mjmlApplicationId }
						onChange={ value => setKeys( { ...keys, mjml_api_key: value } ) }
						disabled={ inFlight }
						onKeyDown={ event => {
							if ( canSubmit && ENTER === event.keyCode ) {
								event.preventDefault();
								commitSettings();
							}
						} }
						className={ errors.newspack_newsletters_invalid_keys_mjml && 'has-error' }
					/>
					<TextControl
						label={ __( 'MJML secret key', 'newspack-newsletters' ) }
						value={ mjmlAPISecret }
						onChange={ value => setKeys( { ...keys, mjml_api_secret: value } ) }
						disabled={ inFlight }
						onKeyDown={ event => {
							if ( canSubmit && ENTER === event.keyCode ) {
								event.preventDefault();
								commitSettings();
							}
						} }
						className={ errors.newspack_newsletters_invalid_keys_mjml && 'has-error' }
					/>
					{ errors.newspack_newsletters_invalid_keys_mjml && (
						<p className="error">{ errors.newspack_newsletters_invalid_keys_mjml }</p>
					) }
					<p>
						<ExternalLink href="https://mjml.io/api">
							{ __( 'Request MJML API keys', 'newspack-newsletters' ) }
						</ExternalLink>
					</p>
				</div>
			</div>
			<Button isPrimary onClick={ commitSettings } disabled={ inFlight || ! canSubmit }>
				{ __( 'Save settings', 'newspack-newsletter' ) }
			</Button>
		</Fragment>
	);
};

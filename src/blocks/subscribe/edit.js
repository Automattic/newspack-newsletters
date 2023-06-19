/* globals newspack_newsletters_blocks */
/* eslint jsx-a11y/label-has-for: 0 */
/**
 * External dependencies.
 */
import classnames from 'classnames';
import { intersection } from 'lodash';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import {
	TextControl,
	ToggleControl,
	CheckboxControl,
	PanelBody,
	Notice,
	Spinner,
	Button,
} from '@wordpress/components';
import { useBlockProps, InspectorControls, RichText } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import './editor.scss';

const getListCheckboxId = listId => {
	return 'newspack-newsletters-list-checkbox-' + listId;
};

const settingsUrl = newspack_newsletters_blocks.settings_url;

const editedStateOptions = [
	{ label: __( 'Initial', 'newspack-newsletters' ), value: 'initial' },
	{ label: __( 'Success', 'newspack-newsletters' ), value: 'success' },
];

export default function SubscribeEdit( {
	setAttributes,
	attributes: {
		displayInputLabels,
		placeholder,
		emailLabel,
		displayNameField,
		displayLastNameField,
		namePlaceholder,
		nameLabel,
		lastNamePlaceholder,
		lastNameLabel,
		label,
		successMessage,
		lists,
		displayDescription,
		mailchimpDoubleOptIn,
	},
} ) {
	const blockProps = useBlockProps();
	const [ editedState, setEditedState ] = useState( editedStateOptions[ 0 ].value );
	const [ inFlight, setInFlight ] = useState( false );
	const [ listConfig, setListConfig ] = useState( {} );
	const fetchLists = () => {
		setInFlight( true );
		apiFetch( {
			path: '/newspack-newsletters/v1/lists_config',
		} )
			.then( setListConfig )
			.finally( () => setInFlight( false ) );
	};
	useEffect( fetchLists, [] );
	useEffect( () => {
		const listIds = Object.keys( listConfig );
		if ( listIds.length && ( ! lists.length || ! intersection( lists, listIds ).length ) ) {
			setAttributes( { lists: [ Object.keys( listConfig )[ 0 ] ] } );
		}
	}, [ listConfig ] );
	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Form settings', 'newspack-newsletters' ) }>
					<ToggleControl
						label={ __( 'Display input labels', 'newspack-newsletters' ) }
						checked={ displayInputLabels }
						onChange={ value => setAttributes( { displayInputLabels: value } ) }
					/>
					<TextControl
						label={ __( 'Email placeholder', 'newspack-newsletters' ) }
						value={ placeholder }
						onChange={ value => setAttributes( { placeholder: value } ) }
					/>
					<ToggleControl
						label={ __( 'Display name field', 'newspack-newsletters' ) }
						checked={ displayNameField }
						onChange={ value => setAttributes( { displayNameField: value } ) }
					/>
					{ displayNameField && (
						<>
							<TextControl
								label={ __( 'Name placeholder', 'newspack-newsletters' ) }
								value={ namePlaceholder }
								onChange={ value => setAttributes( { namePlaceholder: value } ) }
							/>
							<ToggleControl
								label={ __( 'Display "Last Name" field', 'newspack-newsletters' ) }
								checked={ displayLastNameField }
								onChange={ value => setAttributes( { displayLastNameField: value } ) }
							/>
							{ displayLastNameField && (
								<TextControl
									label={ __( '"Last Name" placeholder', 'newspack-newsletters' ) }
									value={ lastNamePlaceholder }
									onChange={ value => setAttributes( { lastNamePlaceholder: value } ) }
								/>
							) }
						</>
					) }
					{ lists.length > 1 && (
						<ToggleControl
							label={ __( 'Display list description', 'newspack-newsletters' ) }
							checked={ displayDescription }
							onChange={ () => setAttributes( { displayDescription: ! displayDescription } ) }
						/>
					) }
				</PanelBody>
				<PanelBody title={ __( 'Subscription Lists', 'newspack-newsletters' ) }>
					{ inFlight && <Spinner /> }
					{ ! inFlight && ! Object.keys( listConfig ).length && (
						<div style={ { marginBottom: '1.5rem' } }>
							<Notice isDismissible={ false } status="error">
								{ __( 'You must enable lists for subscription.', 'newspack-newsletters' ) }
							</Notice>
						</div>
					) }
					{ lists.length < 1 && (
						<div style={ { marginBottom: '1.5rem' } }>
							<Notice isDismissible={ false } status="error">
								{ __( 'You must select at least one list.', 'newspack-newsletters' ) }
							</Notice>
						</div>
					) }
					{ Object.keys( listConfig ).map( listId => (
						<ToggleControl
							key={ listId }
							label={ listConfig[ listId ].title }
							checked={ lists.includes( listId ) }
							onChange={ () => {
								if ( ! lists.includes( listId ) ) {
									setAttributes( { lists: lists.concat( listId ) } );
								} else {
									setAttributes( { lists: lists.filter( id => id !== listId ) } );
								}
							} }
						/>
					) ) }
					<p>
						<a href={ settingsUrl }>
							{ __( 'Manage your subscription lists', 'newspack-newsletters' ) }
						</a>
					</p>
				</PanelBody>
				{ newspack_newsletters_blocks.provider === 'mailchimp' && (
					<PanelBody title={ __( 'Mailchimp Settings', 'newspack-newsletters' ) }>
						<CheckboxControl
							label={ __( 'Enable double opt-in', 'newspack-newsletters' ) }
							help={ __(
								'Whether the new contact will have its status as "pending" until email confirmation',
								'newspack-newsletters'
							) }
							checked={ mailchimpDoubleOptIn }
							onChange={ value => setAttributes( { mailchimpDoubleOptIn: value } ) }
						/>
					</PanelBody>
				) }
				{ newspack_newsletters_blocks.supports_recaptcha && (
					<PanelBody title={ __( 'Spam protection', 'newspack' ) }>
						<p>
							{ sprintf(
								// translators: %s is either 'enabled' or 'disabled'.
								__( 'reCAPTCHA v3 is currently %s.', 'newspack' ),
								newspack_newsletters_blocks.has_recaptcha
									? __( 'enabled', 'newspack' )
									: __( 'disabled', 'newspack' )
							) }
						</p>
						{ ! newspack_newsletters_blocks.has_recaptcha && (
							<p>
								{ __(
									"It's highly recommended that you enable reCAPTCHA v3 protection to prevent spambots from using this form!",
									'newspack'
								) }
							</p>
						) }
						<p>
							<a href={ newspack_newsletters_blocks.recaptcha_url }>
								{ __( 'Configure your reCAPTCHA settings.', 'newspack' ) }
							</a>
						</p>
					</PanelBody>
				) }
			</InspectorControls>
			<div { ...blockProps }>
				<div className="newspack-newsletters-subscribe__state-bar">
					<span>{ __( 'Edited State', 'newspack-newsletters' ) }</span>
					<div>
						{ editedStateOptions.map( option => (
							<Button
								key={ option.value }
								data-is-active={ editedState === option.value }
								onClick={ () => setEditedState( option.value ) }
							>
								{ option.label }
							</Button>
						) ) }
					</div>
				</div>

				{ inFlight ? (
					<Spinner />
				) : (
					<div
						className={ classnames( {
							'newspack-newsletters-subscribe': true,
							'multiple-lists': lists.length > 1,
						} ) }
						data-status="200"
					>
						{ editedState === 'initial' && (
							<form onSubmit={ ev => ev.preventDefault() }>
								{ lists.length > 1 && (
									<div className="newspack-newsletters-lists">
										<ul>
											{ lists.map( listId => (
												<li key={ listId }>
													<span className="list-checkbox">
														<input
															id={ getListCheckboxId( listId ) }
															type="checkbox"
															checked
															readOnly
														/>
													</span>
													<span className="list-details">
														<label htmlFor={ getListCheckboxId( listId ) }>
															<span className="list-title">{ listConfig[ listId ]?.title }</span>
															{ displayDescription && (
																<span className="list-description">
																	{ listConfig[ listId ]?.description }
																</span>
															) }
														</label>
													</span>
												</li>
											) ) }
										</ul>
									</div>
								) }
								{ displayNameField && (
									<div className="newspack-newsletters-name-input">
										<div className="newspack-newsletters-name-input-item">
											<label>
												{ displayInputLabels && (
													<RichText
														onChange={ value => setAttributes( { nameLabel: value } ) }
														placeholder={ __( 'Name', 'newspack' ) }
														value={ nameLabel }
														tagName="span"
													/>
												) }
											</label>
											<input type="text" placeholder={ namePlaceholder } />
										</div>
										{ displayLastNameField && (
											<div className="newspack-newsletters-name-input-item">
												<label>
													{ displayInputLabels && (
														<RichText
															onChange={ value => setAttributes( { lastNameLabel: value } ) }
															placeholder={ __( 'Last Name', 'newspack' ) }
															value={ lastNameLabel }
															tagName="span"
														/>
													) }
												</label>
												<input type="text" placeholder={ lastNamePlaceholder } />
											</div>
										) }
									</div>
								) }
								<div className="newspack-newsletters-email-input">
									<label>
										{ displayInputLabels && (
											<RichText
												onChange={ value => setAttributes( { emailLabel: value } ) }
												placeholder={ __( 'Email Address', 'newspack' ) }
												value={ emailLabel }
												tagName="span"
											/>
										) }
									</label>
									<input type="email" placeholder={ placeholder } />
									<button type="submit">
										<RichText
											onChange={ value => setAttributes( { label: value } ) }
											placeholder={ __( 'Sign up', 'newspack' ) }
											value={ label }
											tagName="span"
										/>
									</button>
								</div>
							</form>
						) }
						{ editedState === 'success' && (
							<div className="newspack-newsletters-subscribe__response">
								<div className="newspack-newsletters-subscribe__icon" />
								<div className="newspack-newsletters-subscribe__message">
									<RichText
										onChange={ value => setAttributes( { successMessage: value } ) }
										placeholder={ __( 'Success message', 'newspack-newsletters' ) }
										value={ successMessage }
										tagName="p"
										className="message status-200"
										allowedFormats={ [ 'core/bold', 'core/italic' ] }
									/>
								</div>
							</div>
						) }
					</div>
				) }
			</div>
		</>
	);
}

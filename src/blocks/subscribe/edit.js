/**
 * External dependencies.
 */
import classnames from 'classnames';
import { intersection } from 'lodash';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import { TextControl, ToggleControl, PanelBody, Notice, Spinner } from '@wordpress/components';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import './editor.scss';

const getListCheckboxId = listId => {
	return 'newspack-newsletters-list-checkbox-' + listId;
};

const settingsUrl = window.newspack_newsletters_blocks.settings_url;

export default function SubscribeEdit( {
	setAttributes,
	attributes: {
		placeholder,
		displayNameField,
		displayLastNameField,
		namePlaceholder,
		lastNamePlaceholder,
		label,
		lists,
		displayDescription,
	},
} ) {
	const blockProps = useBlockProps();
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
	const getNameFieldPlaceholder = () => {
		if ( namePlaceholder ) {
			return namePlaceholder;
		}
		if ( displayLastNameField ) {
			return __( 'First Name', 'newspack-newsletters' );
		}
		return __( 'Name', 'newspack-newsletters' );
	};
	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Form settings', 'newspack-newsletters' ) }>
					<TextControl
						label={ __( 'Input placeholder', 'newspack-newsletters' ) }
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
								label={ __( 'Name field placeholder', 'newspack-newsletters' ) }
								value={ namePlaceholder }
								placeholder={ getNameFieldPlaceholder() }
								onChange={ value => setAttributes( { namePlaceholder: value } ) }
							/>
							<ToggleControl
								label={ __( 'Display "Last Name" field', 'newspack-newsletters' ) }
								checked={ displayLastNameField }
								onChange={ value => setAttributes( { displayLastNameField: value } ) }
							/>
							{ displayLastNameField && (
								<TextControl
									label={ __( '"Last Name" field placeholder', 'newspack-newsletters' ) }
									value={ lastNamePlaceholder }
									onChange={ value => setAttributes( { lastNamePlaceholder: value } ) }
								/>
							) }
						</>
					) }
					<TextControl
						label={ __( 'Button label', 'newspack-newsletters' ) }
						value={ label }
						onChange={ value => setAttributes( { label: value } ) }
					/>
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
			</InspectorControls>
			<div { ...blockProps }>
				{ inFlight ? (
					<Spinner />
				) : (
					<div
						className={ classnames( {
							'newspack-newsletters-subscribe': true,
							'multiple-lists': lists.length > 1,
						} ) }
					>
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
									<input type="text" placeholder={ getNameFieldPlaceholder() } />
									{ displayLastNameField && (
										<input type="text" placeholder={ lastNamePlaceholder } />
									) }
								</div>
							) }
							<div className="newspack-newsletters-email-input">
								<input type="email" placeholder={ placeholder } />
								<input type="submit" value={ label } />
							</div>
						</form>
					</div>
				) }
			</div>
		</>
	);
}

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

export default function SubscribeEdit( {
	setAttributes,
	attributes: { placeholder, label, lists, displayDescription },
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
	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Form settings', 'newspack-newsletters' ) }>
					<TextControl
						label={ __( 'Input placeholder', 'newspack-newsletters' ) }
						value={ placeholder }
						onChange={ value => setAttributes( { placeholder: value } ) }
					/>
					<TextControl
						label={ __( 'Button label', 'newspack-newsletters' ) }
						value={ label }
						onChange={ value => setAttributes( { label: value } ) }
					/>
					<ToggleControl
						label={ __( 'Display list description', 'newspack-newsletters' ) }
						checked={ displayDescription }
						disabled={ lists.length <= 1 }
						onChange={ () => setAttributes( { displayDescription: ! displayDescription } ) }
					/>
				</PanelBody>
				<PanelBody title={ __( 'Subscription Lists', 'newspack-newsletters' ) }>
					{ inFlight && <Spinner /> }
					{ ! inFlight && ! Object.keys( listConfig ).length && (
						<Notice isDismissible={ false } status="error">
							{ __( 'You must enable lists for subscription.', 'newspack-newsletters' ) }
						</Notice>
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
							<div className="newspack-newsletters-email-input">
								<input type="email" placeholder={ placeholder } />
							</div>
							{ lists.length > 1 && (
								<ul className="newspack-newsletters-lists">
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
							) }
							<input type="submit" value={ label } />
						</form>
					</div>
				) }
			</div>
		</>
	);
}

/**
 * External dependencies.
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { useState, useEffect } from '@wordpress/element';
import { TextControl, ToggleControl, PanelBody } from '@wordpress/components';
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
	const defaultPlaceholder = __( 'Enter your email address', 'newspack-newsletters' );
	const defaultLabel = __( 'Register', 'newspack-newsletters' );
	const blockProps = useBlockProps();
	const [ listConfig, setListConfig ] = useState( {} );
	const fetchLists = () => {
		apiFetch( {
			path: '/newspack-newsletters/v1/lists_config',
		} ).then( setListConfig );
	};
	useEffect( fetchLists, [] );
	useEffect( () => {
		const listIds = Object.keys( listConfig );
		if ( listIds.length && ! lists.length ) {
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
						placeholder={ defaultPlaceholder }
						onChange={ value => setAttributes( { placeholder: value } ) }
					/>
					<TextControl
						label={ __( 'Button label', 'newspack-newsletters' ) }
						value={ label }
						placeholder={ defaultLabel }
						onChange={ value => setAttributes( { label: value } ) }
					/>
					<ToggleControl
						label={ __( 'Display list description', 'newspack-newsletters' ) }
						checked={ displayDescription }
						onChange={ () => setAttributes( { displayDescription: ! displayDescription } ) }
					/>
				</PanelBody>
				<PanelBody title={ __( 'Lists', 'newspack-newsletters' ) }>
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
				<div
					className={ classnames( {
						'newspack-newsletters-subscribe': true,
						'multiple-lists': lists.length > 1,
					} ) }
				>
					<form onSubmit={ ev => ev.preventDefault() }>
						<div className="newspack-newsletters-email-input">
							<input type="email" placeholder={ placeholder || defaultPlaceholder } />
						</div>
						{ lists.length > 1 && (
							<ul className="newspack-newsletters-lists">
								{ lists.map( listId => (
									<li key={ listId }>
										<div className="list-checkbox">
											<input id={ getListCheckboxId( listId ) } type="checkbox" />
										</div>
										<div className="list-details">
											<label htmlFor={ getListCheckboxId( listId ) }>
												{ listConfig[ listId ]?.title }
											</label>
											{ displayDescription && <p>{ listConfig[ listId ]?.description }</p> }
										</div>
									</li>
								) ) }
							</ul>
						) }
						<input type="submit" value={ label || defaultLabel } />
					</form>
				</div>
			</div>
		</>
	);
}

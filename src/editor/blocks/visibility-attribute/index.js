/**
 * External dependencies
 */
import { assign } from 'lodash';

/**
 * WordPress dependencies
 */
import { Fragment } from '@wordpress/element';
import { createHigherOrderComponent } from '@wordpress/compose';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

const ATTRIBUTE_NAME = 'newsletterVisibility';

const visibilityOptions = [
	{
		label: __( 'Email and Web', 'newspack-newsletters' ),
		value: '',
	},
	{
		label: __( 'Email only', 'newspack-newsletters' ),
		value: 'email',
	},
	{
		label: __( 'Web only', 'newspack-newsletters' ),
		value: 'web',
	},
];

const addVisibilityAttribute = settings => {
	settings.attributes = assign( settings.attributes, {
		[ ATTRIBUTE_NAME ]: {
			type: 'string',
			default: visibilityOptions[ 0 ].value,
		},
	} );
	return settings;
};

const withVisibilityControl = createHigherOrderComponent( BlockEdit => {
	return props => {
		const { attributes, setAttributes } = props;
		const value = attributes[ ATTRIBUTE_NAME ];
		return (
			<Fragment>
				<BlockEdit { ...props } />
				<InspectorControls>
					<PanelBody
						title={ __( 'Visibility options', 'newspack-newsletters' ) }
						initialOpen={ true }
					>
						<SelectControl
							label={ __( 'Where should this block be visible?', 'newspack-newsletters' ) }
							value={ value }
							options={ visibilityOptions }
							onChange={ selected => {
								setAttributes( { [ ATTRIBUTE_NAME ]: selected } );
							} }
							help={ __(
								"If the newsletter is going to be viewable publicly on this site, select here if you'd like this block to be visible in a particular version.",
								'newspack-newsletters'
							) }
						/>
					</PanelBody>
				</InspectorControls>
			</Fragment>
		);
	};
}, 'withVisibilityControl' );

export default () => {
	wp.hooks.addFilter(
		'blocks.registerBlockType',
		'newspack-newsletters/visibility-attribute',
		addVisibilityAttribute
	);
	wp.hooks.addFilter(
		'editor.BlockEdit',
		'newspack-newsletters/visibility-control',
		withVisibilityControl
	);
};

/**
 * External dependencies
 */
import { assign } from 'lodash';
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { Fragment } from '@wordpress/element';
import { compose, createHigherOrderComponent } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import { BlockControls, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, ToolbarGroup, SelectControl, ToolbarDropdownMenu } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { Icon, warning, globe } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './style.scss';

const ATTRIBUTE_NAME = 'newsletterVisibility';

const visibilityOptions = [
	{
		label: __( 'Email and Web', 'newspack-newsletters' ),
		value: '',
		icon: 'visibility',
	},
	{
		label: __( 'Email only', 'newspack-newsletters' ),
		value: 'email',
		icon: 'email',
	},
	{
		label: __( 'Web only', 'newspack-newsletters' ),
		value: 'web',
		icon: globe,
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

const withVisibilityControl = createHigherOrderComponent(
	BlockEdit =>
		compose(
			withSelect( select => {
				const { is_public } = select( 'core/editor' ).getEditedPostAttribute( 'meta' );
				return { is_public };
			} )
		)( props => {
			const { attributes, setAttributes } = props;
			const value = attributes[ ATTRIBUTE_NAME ];
			const currentIcon =
				visibilityOptions.find( option => option.value === value )?.icon || 'visibility';
			const menuLabel = value
				? sprintf( __( 'Currently visible only on "%s" version.', 'newspack-newsletters' ), value )
				: __( 'Select a visibility option', 'newspack-newsletter' );
			if ( ! props.is_public && ! value ) {
				return <BlockEdit { ...props } />;
			}
			return (
				<Fragment>
					<BlockControls>
						<ToolbarGroup>
							<ToolbarDropdownMenu
								icon={ currentIcon }
								label={ menuLabel }
								toggleProps={ {
									className: classnames( { 'is-pressed': !! value } ),
								} }
								controls={ visibilityOptions.map( option => ( {
									icon: option.icon,
									title: option.label,
									onClick: () => setAttributes( { [ ATTRIBUTE_NAME ]: option.value } ),
								} ) ) }
							/>
						</ToolbarGroup>
					</BlockControls>
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
		} ),
	'withVisibilityControl'
);

const withVisibilityNotice = createHigherOrderComponent(
	BlockListBlock =>
		compose(
			withSelect( select => {
				const { is_public } = select( 'core/editor' ).getEditedPostAttribute( 'meta' );
				return { is_public };
			} )
		)( props => {
			const value = props.attributes[ ATTRIBUTE_NAME ];
			const shouldBePublic = ! props.is_public && value === 'web';
			if ( value && ( ( props.is_public && value === 'email' ) || value === 'web' ) ) {
				return (
					<div
						className={ classnames( {
							'wp-block': true,
							'newspack-newsletters__editor-block': true,
							[ `newsletters-block-visibility__${ value }` ]: !! value,
							'newsletters-block-selected': props.isSelected,
							'newsletters-block-error': shouldBePublic,
						} ) }
						data-align={ props.attributes?.align || null }
					>
						<span className="newsletters-block-visibility-label">
							<Icon icon={ warning } size={ 15 } />
							{ sprintf(
								__( 'Only visible on the "%s" version.', 'newspack-newsletters' ),
								value
							) }
							{ shouldBePublic
								? ' ' + __( 'Newsletter is not public.', 'newspack-newsletters' )
								: null }
						</span>
						<BlockListBlock { ...props } />
					</div>
				);
			}
			return <BlockListBlock { ...props } />;
		} ),
	'withVisibilityNotice'
);

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
	wp.hooks.addFilter(
		'editor.BlockListBlock',
		'newspack-newsletters/visibility-notice',
		withVisibilityNotice
	);
};

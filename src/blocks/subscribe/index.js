/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { TextControl, PanelBody } from '@wordpress/components';
import { InspectorControls } from '@wordpress/block-editor';
import { Fragment } from '@wordpress/element';
import { Icon, box } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './style.scss';
import blockDefinition from './block.json';

const edit = ( { setAttributes, attributes } ) => {
	const defaultPlaceholder = __( 'Enter your email address', 'newspack-newsletters' );
	const defaultButtonLabel = __( 'Subscribe', 'newspack-newsletters' );
	return (
		<Fragment>
			<InspectorControls>
				<PanelBody title={ __( 'Form settings', 'newspack-newsletters' ) }>
					<TextControl
						label={ __( 'Input placeholder', 'newspack-newsletters' ) }
						value={ attributes.placeholder }
						placeholder={ defaultPlaceholder }
						onChange={ value => setAttributes( { placeholder: value } ) }
					/>
					<TextControl
						label={ __( 'Button label', 'newspack-newsletters' ) }
						value={ attributes.button_label }
						placeholder={ defaultButtonLabel }
						onChange={ value => setAttributes( { button_label: value } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<div className="newspack-newsletters-subscribe-block">
				<form>
					<input type="email" placeholder={ attributes.placeholder || defaultPlaceholder } />
					<button>{ attributes.button_label || defaultButtonLabel }</button>
				</form>
			</div>
		</Fragment>
	);
};

export default () => {
	registerBlockType( blockDefinition.name, {
		...blockDefinition,
		title: __( 'Newspack Newsletters Subscribe', 'newspack-newsletters' ),
		icon: <Icon icon={ box } />,
		edit,
		save: () => null,
	} );
};

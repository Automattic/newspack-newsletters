/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import { __ } from '@wordpress/i18n';
import { withDispatch, withSelect } from '@wordpress/data';
import { Fragment } from '@wordpress/element';
import { SelectControl } from '@wordpress/components';

const fontOptions = [
	{
		value: null,
		label: __( 'Sans Serif', 'newspack-newsletters' ),
		disabled: true,
	},
	{
		value: 'Arial',
		label: __( 'Arial', 'newspack-newsletters' ),
	},
	{
		value: 'System',
		label: __( 'System', 'newspack-newsletters' ),
	},
	{
		value: 'Tahoma',
		label: __( 'Tahoma', 'newspack-newsletters' ),
	},
	{
		value: '"Trebuchet MS"',
		label: __( 'Trebuchet MS', 'newspack-newsletters' ),
	},
	{
		value: 'Verdana',
		label: __( 'Verdana', 'newspack-newsletters' ),
	},
	{
		value: null,
		label: __( 'Serif', 'newspack-newsletters' ),
		disabled: true,
	},
	{
		value: 'Georgia',
		label: __( 'Georgia', 'newspack-newsletters' ),
	},
	{
		value: 'Palatino',
		label: __( 'Palatino', 'newspack-newsletters' ),
	},
	{
		value: 'TimesNewRoman',
		label: __( 'Times New Roman', 'newspack-newsletters' ),
	},
	{
		value: null,
		label: __( 'Monospace', 'newspack-newsletters' ),
		disabled: true,
	},
	{
		value: 'Courier',
		label: __( 'Courier New', 'newspack-newsletters' ),
	},
];

export default compose( [
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		return { editPost };
	} ),
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			fontBody: meta.font_body || '',
			fontHeader: meta.font_header || '',
		};
	} ),
] )( ( { editPost, fontBody, fontHeader } ) => {
	return (
		<Fragment>
			<SelectControl
				label={ __( 'Headings', 'newspack-newsletters' ) }
				value={ fontHeader }
				options={ fontOptions }
				onChange={ value => editPost( { meta: { font_header: value } } ) }
			/>
			<SelectControl
				label={ __( 'Body', 'newspack-newsletters' ) }
				value={ fontBody }
				options={ fontOptions }
				onChange={ value => editPost( { meta: { font_body: value } } ) }
			/>
		</Fragment>
	);
} );

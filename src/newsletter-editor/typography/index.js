/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { compose } from '@wordpress/compose';
import { __ } from '@wordpress/i18n';
import { withDispatch, withSelect } from '@wordpress/data';
import { Fragment, useEffect } from '@wordpress/element';
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
		value: 'Tahoma',
		label: __( 'Tahoma', 'newspack-newsletters' ),
	},
	{
		value: 'TrebuchetMS',
		label: __( 'Trebuchet', 'newspack-newsletters' ),
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
		const { getEditedPostAttribute, getCurrentPostId } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			postId: getCurrentPostId(),
			fontBody: meta.font_body || '',
			fontHeader: meta.font_header || '',
		};
	} ),
] )( ( { editPost, fontBody, fontHeader, postId } ) => {
	const updateFontValue = ( key, value ) => {
		editPost( { meta: { [ key ]: value } } );
		apiFetch( {
			data: { key, value },
			method: 'POST',
			path: `/newspack-newsletters/v1/typography/${ postId }`,
		} );
	};
	useEffect(() => {
		document.documentElement.style.setProperty( '--body-font', fontBody );
	}, [ fontBody ]);
	useEffect(() => {
		document.documentElement.style.setProperty( '--header-font', fontHeader );
	}, [ fontHeader ]);
	return (
		<Fragment>
			<SelectControl
				label={ __( 'Headings', 'newspack-newsletters' ) }
				value={ fontHeader || 'Arial' }
				options={ fontOptions }
				onChange={ value => updateFontValue( 'font_header', value ) }
			/>
			<SelectControl
				label={ __( 'Body', 'newspack-newsletters' ) }
				value={ fontBody || 'Georgia' }
				options={ fontOptions }
				onChange={ value => updateFontValue( 'font_body', value ) }
			/>
		</Fragment>
	);
} );

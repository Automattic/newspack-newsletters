/* eslint-disable jsdoc/no-undefined-types, jsdoc/valid-types */

/**
 * WordPress dependencies
 */
import { PlainText } from '@wordpress/block-editor';
import { compose, useInstanceId } from '@wordpress/compose';
import { ColorPicker, BaseControl, Panel, PanelBody, PanelRow } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useSelect, withDispatch, withSelect } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import SelectControlWithOptGroup from '../../components/select-control-with-optgroup/';

/**
 * Internal dependencies
 */
import './style.scss';

const fontOptgroups = [
	{
		label: __( 'Sans Serif', 'newspack-newsletters' ),
		options: [
			{
				value: 'Arial, Helvetica, sans-serif',
				label: __( 'Arial', 'newspack-newsletters' ),
			},
			{
				value: 'Tahoma, sans-serif',
				label: __( 'Tahoma', 'newspack-newsletters' ),
			},
			{
				value: 'Trebuchet MS, sans-serif',
				label: __( 'Trebuchet', 'newspack-newsletters' ),
			},
			{
				value: 'Verdana, sans-serif',
				label: __( 'Verdana', 'newspack-newsletters' ),
			},
		],
	},

	{
		label: __( 'Serif', 'newspack-newsletters' ),
		options: [
			{
				value: 'Georgia, serif',
				label: __( 'Georgia', 'newspack-newsletters' ),
			},
			{
				value: 'Palatino, serif',
				label: __( 'Palatino', 'newspack-newsletters' ),
			},
			{
				value: 'Times New Roman, serif',
				label: __( 'Times New Roman', 'newspack-newsletters' ),
			},
		],
	},

	{
		label: __( 'Monospace', 'newspack-newsletters' ),
		options: [
			{
				value: 'Courier, monospace',
				label: __( 'Courier', 'newspack-newsletters' ),
			},
		],
	},
];

const customStylesSelector = select => {
	const { getEditedPostAttribute } = select( 'core/editor' );
	const meta = getEditedPostAttribute( 'meta' );
	return {
		fontBody: meta.font_body || fontOptgroups[ 1 ].options[ 0 ].value,
		fontHeader: meta.font_header || fontOptgroups[ 0 ].options[ 0 ].value,
		backgroundColor: meta.background_color || '#ffffff',
		customCss: meta.custom_css || '',
	};
};

// Create a temporary DOM document (not displayed) for parsing CSS rules.
const doc = document.implementation.createHTMLDocument( 'Temp' );

/**
 * Takes a given CSS string, parses it, and scopes all its rules to the given `scope`.
 *
 * @param {string} scope The scope to apply to each rule in the CSS.
 * @param {string} css   The CSS to scope.
 * @return {string} Scoped CSS string.
 */
export const getScopedCss = ( scope, css ) => {
	const style = doc.querySelector( 'style' ) || document.createElement( 'style' );

	style.textContent = css;
	doc.head.appendChild( style );

	const rules = [ ...style.sheet.cssRules ];
	return rules
		.map( rule => {
			rule.selectorText = rule.selectorText
				.split( ',' )
				.map( selector => `${ scope } ${ selector }` )
				.join( ', ' );
			return rule.cssText;
		} )
		.join( '\n' );
};

/**
 * Hook to apply body and header fonts variables in store to an iframe as root
 * element style property.
 *
 * @return {import('react').RefObject} The component to be rendered.
 */
export const useCustomFontsInIframe = () => {
	const ref = useRef();
	const { fontBody, fontHeader } = useSelect( customStylesSelector );
	useEffect( () => {
		const node = ref.current;
		const updateIframe = () => {
			const iframe = node.querySelector( 'iframe[title="Editor canvas"]' );
			if ( iframe ) {
				const updateStyleProperties = () => {
					const element = iframe.contentDocument?.documentElement;
					if ( element ) {
						element.style.setProperty( '--newspack-body-font', fontBody );
						element.style.setProperty( '--newspack-header-font', fontHeader );
						element.querySelector( 'body' ).style.setProperty( 'background', 'none' );
					}
				};
				updateStyleProperties();
				// Handle Firefox iframe.
				iframe.addEventListener( 'load', updateStyleProperties );
				return () => {
					iframe.removeEventListener( 'load', updateStyleProperties );
				};
			}
		};
		updateIframe();
		const observer = new MutationObserver( updateIframe );
		observer.observe( node, { childList: true } );
		return () => {
			observer.disconnect();
		};
	}, [ fontBody, fontHeader ] );
	return ref;
};

export const ApplyStyling = withSelect( customStylesSelector )(
	( { fontBody, fontHeader, backgroundColor, customCss } ) => {
		useEffect( () => {
			document.documentElement.style.setProperty( '--newspack-body-font', fontBody );
		}, [ fontBody ] );
		useEffect( () => {
			document.documentElement.style.setProperty( '--newspack-header-font', fontHeader );
		}, [ fontHeader ] );
		useEffect( () => {
			const editorElement = document.querySelector( '.editor-styles-wrapper' );
			if ( editorElement ) {
				editorElement.style.backgroundColor = backgroundColor;
			}
		}, [ backgroundColor ] );
		useEffect( () => {
			const editorElement = document.querySelector( '.edit-post-visual-editor' );
			if ( editorElement ) {
				let styleEl = document.getElementById( 'newspack-newsletters__custom-styles' );
				if ( ! styleEl ) {
					styleEl = document.createElement( 'style' );
					styleEl.setAttribute( 'type', 'text/css' );
					styleEl.setAttribute( 'id', 'newspack-newsletters__custom-styles' );
					document.head.appendChild( styleEl );
				}

				const scopedCss = getScopedCss( '.edit-post-visual-editor', customCss );

				styleEl.textContent = scopedCss;
			}
		}, [ customCss ] );

		return null;
	}
);

export const Styling = compose( [
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		return { editPost };
	} ),
	withSelect( customStylesSelector ),
] )( ( { editPost, fontBody, fontHeader, customCss, backgroundColor } ) => {
	const updateStyleValue = ( key, value ) => {
		editPost( { meta: { [ key ]: value } } );
	};

	const instanceId = useInstanceId( SelectControlWithOptGroup );
	const id = `inspector-select-control-${ instanceId }`;

	return (
		<Panel>
			<PanelBody
				name="newsletters-typography-panel"
				title={ __( 'Typography', 'newspack-newsletters' ) }
			>
				<PanelRow>
					<SelectControlWithOptGroup
						label={ __( 'Headings font', 'newspack-newsletters' ) }
						value={ fontHeader }
						optgroups={ fontOptgroups }
						onChange={ value => updateStyleValue( 'font_header', value ) }
					/>
				</PanelRow>
				<PanelRow>
					<SelectControlWithOptGroup
						label={ __( 'Body font', 'newspack-newsletters' ) }
						value={ fontBody }
						optgroups={ fontOptgroups }
						onChange={ value => updateStyleValue( 'font_body', value ) }
					/>
				</PanelRow>
			</PanelBody>
			<PanelBody name="newsletters-color-panel" title={ __( 'Color', 'newspack-newsletters' ) }>
				<PanelRow className="newspack-newsletters__color-panel">
					<BaseControl label={ __( 'Background color', 'newspack-newsletters' ) } id={ id }>
						<ColorPicker
							id={ id }
							color={ backgroundColor }
							onChangeComplete={ value => updateStyleValue( 'background_color', value.hex ) }
							disableAlpha
						/>
					</BaseControl>
				</PanelRow>
			</PanelBody>
			<PanelBody
				name="newsletters-css-panel"
				title={ __( 'Custom CSS', 'newspack-newsletters' ) }
				initialOpen={ false }
			>
				<PanelRow className="newspack-newsletters__css-panel">
					<BaseControl
						id={ `inspector-custom-css-control-${ instanceId }` }
						label={ __( 'Custom CSS', 'newspack-newsletters' ) }
						help={ __(
							'This is an advanced feature and may result in unpredictable behavior. Custom CSS will be appended to default styles in sent emails only.',
							'newspack-newsletters'
						) }
						hideLabelFromVision
					>
						<PlainText
							className="components-textarea-control__input"
							value={ customCss }
							onChange={ content => editPost( { meta: { custom_css: content } } ) }
							aria-label={ __( 'Custom CSS', 'newspack-newsletters' ) }
							placeholder={ __( 'Write custom CSS…', 'newspack-newsletters' ) }
						/>
					</BaseControl>
				</PanelRow>
			</PanelBody>
		</Panel>
	);
} );

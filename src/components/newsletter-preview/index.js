/**
 * WordPress dependencies
 */
import { useRefEffect } from '@wordpress/compose';
import { BlockPreview } from '@wordpress/block-editor';
import { Fragment, useMemo, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import './style.scss';
import { getScopedCss } from '../../newsletter-editor/styling';

const NewsletterPreview = ( { meta = {}, ...props } ) => {
	const ELEMENT_ID = useMemo( () => `preview-${ Math.round( Math.random() * 1000 ) }`, [] );

	const [ css, setCss ] = useState( '' );

	const useInlineStyles = useRefEffect(
		node => {
			const cssRules = [];
			if ( meta.font_body ) {
				cssRules.push( `*:not( code ) { font-family: ${ meta.font_body }; }` );
			}
			if ( meta.font_header ) {
				cssRules.push( `h1, h2, h3, h4, h5, h6 { font-family: ${ meta.font_header }; }` );
			}
			if ( meta.custom_css ) {
				cssRules.push( meta.custom_css );
			}
			if ( ! cssRules.length ) {
				return;
			}
			const inlineCss = getScopedCss( `#${ ELEMENT_ID }`, cssRules.join( '\n' ) );
			setCss( inlineCss );
			const style = document.createElement( 'style' );
			const appendStyle = () => {
				const iframe = node.querySelector( 'iframe[title="Editor canvas"]' );
				if ( iframe ) {
					iframe.addEventListener( 'load', () => {
						style.textContent = inlineCss;
						iframe.contentDocument.body.id = ELEMENT_ID;
						iframe.contentDocument.head.appendChild( style );
						observer.disconnect();
					} );
				}
			};
			const observer = new MutationObserver( appendStyle );
			observer.observe( node, { childList: true } );
			return () => {
				observer.disconnect();
			};
		},
		[ meta ]
	);

	return (
		<Fragment>
			<style id="newspack-newsletters__layout-css" data-previewid={ ELEMENT_ID }>
				{ css }
			</style>
			<div
				ref={ useInlineStyles }
				id={ ELEMENT_ID }
				className="newspack-newsletters__layout-preview"
				style={ {
					backgroundColor: meta.background_color,
				} }
			>
				<BlockPreview { ...props } />
			</div>
		</Fragment>
	);
};

export default NewsletterPreview;

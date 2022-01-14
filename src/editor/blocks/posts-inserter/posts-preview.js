/**
 * WordPress dependencies.
 */
import { useMergeRefs, useRefEffect } from '@wordpress/compose';
import { BlockPreview } from '@wordpress/block-editor';
import { Spinner } from '@wordpress/components';
import { forwardRef } from '@wordpress/element';

/**
 * Posts Preview component.
 */
const PostsPreview = ( { isReady, blocks, viewportWidth }, ref ) => {
	// Iframe styles are not properly applied when nesting iframed editors.
	// This fix ensures the iframe is properly styled.
	const useIframeBorderFix = useRefEffect( node => {
		const updateIframeStyle = () => {
			const iframe = node.querySelector( 'iframe[title="Editor canvas"]' );
			if ( iframe ) {
				iframe.addEventListener( 'load', () => {
					iframe.style.border = 0;
					observer.disconnect();
				} );
			}
		};
		const observer = new MutationObserver( updateIframeStyle );
		observer.observe( node, { childList: true } );
		return () => {
			observer.disconnect();
		};
	}, [] );
	// Append layout style if viewing layout preview.
	const useLayoutStyle = useRefEffect( node => {
		const style = document.getElementById( 'newspack-newsletters__layout-css' );
		if ( ! style ) {
			return;
		}
		const appendLayoutStyle = () => {
			const iframe = node.querySelector( 'iframe[title="Editor canvas"]' );
			if ( iframe ) {
				iframe.addEventListener( 'load', () => {
					iframe.contentDocument.body.id = style.dataset.previewid;
					iframe.contentDocument.head.appendChild( style.cloneNode( true ) );
					observer.disconnect();
				} );
			}
		};
		const observer = new MutationObserver( appendLayoutStyle );
		observer.observe( node, { childList: true } );
		return () => {
			observer.disconnect();
		};
	}, [] );
	return (
		<div
			className="newspack-posts-inserter__preview"
			ref={ useMergeRefs( [ ref, useIframeBorderFix, useLayoutStyle ] ) }
		>
			{ isReady ? <BlockPreview blocks={ blocks } viewportWidth={ viewportWidth } /> : <Spinner /> }
		</div>
	);
};

export default forwardRef( PostsPreview );

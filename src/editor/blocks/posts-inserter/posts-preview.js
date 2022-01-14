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
	const fixIframe = useRefEffect( node => {
		const updateIframeStyle = () => {
			const iframe = node.querySelector( 'iframe[title="Editor canvas"]' );
			if ( iframe ) {
				iframe.style.border = 0;
				observer.disconnect();
			}
		};
		const observer = new MutationObserver( updateIframeStyle );
		observer.observe( node, { childList: true } );
		// Give up after 3s if the iframe is not loaded.
		const disconnectTimeout = setTimeout( observer.disconnect, 3000 );
		return () => {
			observer.disconnect();
			clearTimeout( disconnectTimeout );
		};
	}, [] );
	return (
		<div className="newspack-posts-inserter__preview" ref={ useMergeRefs( [ ref, fixIframe ] ) }>
			{ isReady ? <BlockPreview blocks={ blocks } viewportWidth={ viewportWidth } /> : <Spinner /> }
		</div>
	);
};

export default forwardRef( PostsPreview );

/**
 * WordPress dependencies
 */
import { BlockPreview } from '@wordpress/block-editor';
import { createRef, Fragment, useMemo, useState, useEffect } from '@wordpress/element';
import { Spinner } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './style.scss';

const NewsletterPreview = ( { meta = {}, ...props } ) => {
	const [ ready, setReady ] = useState( false );
	const containerRef = createRef();
	const ELEMENT_ID = useMemo( () => `preview-${ Math.round( Math.random() * 1000 ) }`, [] );

	/**
	 * This hook does the work of an "onReady" callback for each BlockPreview
	 * element. Currently, BlockPreview loads elements directly into the DOM,
	 * resulting in a flash of unstyled content when loading images.
	 *
	 * This hook checks whether the blocks passed to the BlockPreview contain
	 * featured images, and if so, uses a MutationObserver to attach a 'load'
	 * event listener before providing the "ready" style.
	 *
	 * If the blocks do not contain a featured image, we can show them
	 * immediately.
	 */
	useEffect(() => {
		const config = { attributes: false, childList: true, subtree: true };

		// Lazy way of checking for a deeply nested value.
		const hasFeaturedImage =
			-1 !== JSON.stringify( props.blocks ).indexOf( '"displayFeaturedImage":true' );

		// If the block preview contains featured images, listen for images being added to the DOM.
		const observer = new MutationObserver( mutationsList => {
			for ( const mutation of mutationsList ) {
				if ( mutation.addedNodes.length > 0 ) {
					// Convert NodeList to Array for IE11.
					const nodes = Array.prototype.slice.call( mutation.addedNodes );

					nodes.forEach( node => {
						if ( node.classList && node.classList.contains( 'wp-block' ) ) {
							const images = Array.prototype.slice.call(
								node.querySelectorAll( '.wp-block-image img' )
							);

							if ( images.length > 0 ) {
								images.forEach( image => {
									image.addEventListener( 'load', () => setReady( true ) );
									image.addEventListener( 'error', () => setReady( true ) ); // Fallback in case of image load error.
								} );
							}
						}
					} );
				}
			}
		} );

		// Only listen for image load if the block preview contains featured images.
		if ( hasFeaturedImage ) {
			observer.observe( containerRef.current, config );
		} else {
			setReady( true );
		}
	}, [ props.blocks ]);

	return (
		<Fragment>
			<style>{ `${
				meta.font_body
					? `
#${ ELEMENT_ID } *:not( code ) {
  font-family: ${ meta.font_body };
}`
					: ' '
			}${
				meta.font_header
					? `
#${ ELEMENT_ID } h1, #${ ELEMENT_ID } h2, #${ ELEMENT_ID } h3, #${ ELEMENT_ID } h4, #${ ELEMENT_ID } h5, #${ ELEMENT_ID } h6 {
  font-family: ${ meta.font_header };
}`
					: ' '
			}` }</style>
			<div
				ref={ containerRef }
				id={ ELEMENT_ID }
				className="newspack-newsletters__layout-preview"
				style={ {
					backgroundColor: meta.background_color,
				} }
			>
				<BlockPreview { ...props } />
			</div>
			{ ! ready && (
				<div className="newspack-newsletters__layout-preview-spinner">
					<Spinner />
				</div>
			) }
		</Fragment>
	);
};

export default NewsletterPreview;

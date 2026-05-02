/**
 * Defer mounting an expensive child until its placeholder enters the
 * viewport, then keep it mounted.
 *
 * The Layouts grid renders one `<NewsletterPreview>` per card and each
 * preview spawns an iframe via `<BlockPreview>`. Mounting all of them
 * up-front locks up the main thread for several seconds on sites with
 * many layouts, so we wrap the preview in this wrapper: it renders an
 * empty fixed-height placeholder until it scrolls into view, then
 * mounts the children once and leaves them mounted. Scrolling back out
 * doesn't unmount — re-instantiating an iframe is more expensive than
 * the steady-state memory.
 *
 * `IntersectionObserver` is widely supported in admin-targeted browsers;
 * the SSR / no-IO fallback below mounts immediately, which keeps tests
 * and edge environments from rendering nothing.
 */

import { useEffect, useRef, useState } from '@wordpress/element';

/**
 * @param {Object}   props
 * @param {Object}   [props.placeholderStyle] Inline style for the
 *                                            placeholder element while
 *                                            children are deferred.
 *                                            Reserve enough height that
 *                                            the grid doesn't reflow on
 *                                            mount (otherwise scroll
 *                                            position jumps).
 * @param {string}   [props.rootMargin]       Margin to grow the
 *                                            intersection root by — pre-
 *                                            mounts the next row of
 *                                            cards so they're ready when
 *                                            the user reaches them.
 * @param {Function} props.children           Render-prop returning the
 *                                            expensive subtree, called
 *                                            only after first
 *                                            intersection.
 * @return {Object} React element.
 */
export default function LazyPreview( { placeholderStyle, rootMargin = '200px', children } ) {
	const ref = useRef( null );
	const [ isVisible, setIsVisible ] = useState( false );

	useEffect( () => {
		// Already mounted — nothing to observe. Bail to keep the effect
		// from re-attaching an observer on rerenders that bump deps.
		if ( isVisible ) {
			return undefined;
		}
		// SSR / unsupported environments fall through to immediate mount.
		// Returning early without setting state would never reveal the
		// preview, which is a worse failure mode than rendering everything
		// up-front in the rare environment without IntersectionObserver.
		if ( typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined' ) {
			setIsVisible( true );
			return undefined;
		}
		const node = ref.current;
		if ( ! node ) {
			return undefined;
		}
		const observer = new window.IntersectionObserver(
			entries => {
				const entry = entries[ 0 ];
				if ( entry?.isIntersecting ) {
					setIsVisible( true );
					observer.disconnect();
				}
			},
			{ rootMargin }
		);
		observer.observe( node );
		return () => observer.disconnect();
	}, [ isVisible, rootMargin ] );

	return (
		<div ref={ ref } style={ ! isVisible ? placeholderStyle : undefined }>
			{ isVisible ? children() : null }
		</div>
	);
}

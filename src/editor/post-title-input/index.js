/**
 * WordPress dependencies
 */
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { TextControl } from '@wordpress/components';
import { ENTER } from '@wordpress/keycodes';
import { __ } from '@wordpress/i18n';

const CANVAS_IFRAME_SELECTOR = 'iframe[name="editor-canvas"]';
const WRAPPER_SELECTOR = '.editor-visual-editor__post-title-wrapper';
const MOUNT_CLASSNAME = 'newspack-newsletters-post-title-mount';

/**
 * Returns the document hosting the visual editor canvas.
 *
 * Gutenberg renders the canvas inside an iframe with `name="editor-canvas"`; older or
 * non-iframed editors render directly in the host document. We fall back gracefully.
 */
function getCanvasDocument() {
	const iframe = document.querySelector( CANVAS_IFRAME_SELECTOR );
	if ( iframe?.contentDocument?.body ) {
		return iframe.contentDocument;
	}
	return document;
}

/**
 * Replaces Gutenberg's post-title wrapper with a stable mount node we can portal into.
 *
 * Idempotent: if the wrapper is already gone, returns the existing mount (or null).
 */
function placeMount( doc ) {
	const existing = doc.querySelector( `.${ MOUNT_CLASSNAME }` );
	const wrapper = doc.querySelector( WRAPPER_SELECTOR );
	if ( ! wrapper ) {
		return existing || null;
	}
	const mount = existing || doc.createElement( 'div' );
	if ( ! existing ) {
		mount.className = MOUNT_CLASSNAME;
	}
	wrapper.parentNode.insertBefore( mount, wrapper );
	wrapper.remove();
	return mount;
}

export default function PostTitleInput() {
	const inputRef = useRef( null );
	const focusedRef = useRef( false );

	const { title, isCleanNewPost } = useSelect( select => {
		const editor = select( editorStore );
		return {
			title: editor.getEditedPostAttribute( 'title' ) || '',
			isCleanNewPost: editor.isCleanNewPost(),
		};
	}, [] );
	const { editPost } = useDispatch( editorStore );
	const { insertDefaultBlock } = useDispatch( blockEditorStore );

	const [ mountNode, setMountNode ] = useState( null );

	useEffect( () => {
		let canvasDoc = null;
		let canvasObserver = null;

		const attach = doc => {
			if ( canvasObserver ) {
				canvasObserver.disconnect();
				canvasObserver = null;
			}
			canvasDoc = doc;
			const sync = () => {
				const next = placeMount( doc );
				setMountNode( prev => ( prev === next ? prev : next ) );
			};
			sync();
			if ( doc?.body ) {
				canvasObserver = new MutationObserver( sync );
				canvasObserver.observe( doc.body, { childList: true, subtree: true } );
			}
		};

		attach( getCanvasDocument() );

		// The canvas iframe can be torn down and re-mounted (e.g. on device-preview switch).
		// Watch the host document for that, and re-attach to whatever doc the canvas now lives in.
		const parentObserver = new MutationObserver( () => {
			const nextDoc = getCanvasDocument();
			if ( nextDoc !== canvasDoc ) {
				attach( nextDoc );
			}
		} );
		parentObserver.observe( document.body, { childList: true, subtree: true } );

		return () => {
			parentObserver.disconnect();
			canvasObserver?.disconnect();
			const mount = canvasDoc?.querySelector?.( `.${ MOUNT_CLASSNAME }` );
			if ( mount ) {
				mount.remove();
			}
		};
	}, [] );

	// Mirror Gutenberg's behaviour of focusing the title field on a fresh, empty post.
	useEffect( () => {
		if ( focusedRef.current || ! inputRef.current || ! isCleanNewPost ) {
			return;
		}
		const { activeElement, body } = inputRef.current.ownerDocument;
		if ( ! activeElement || body === activeElement ) {
			inputRef.current.focus();
			focusedRef.current = true;
		}
	}, [ isCleanNewPost, mountNode ] );

	if ( ! mountNode ) {
		return null;
	}

	const onKeyDown = event => {
		if ( event.keyCode === ENTER ) {
			event.preventDefault();
			insertDefaultBlock( undefined, undefined, 0 );
		}
	};

	return createPortal(
		<div className="newspack-newsletters-post-title">
			<TextControl
				ref={ inputRef }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Title', 'newspack-newsletters' ) }
				hideLabelFromVision
				value={ title }
				onChange={ value => editPost( { title: value } ) }
				onKeyDown={ onKeyDown }
				placeholder={ __( 'Add title', 'newspack-newsletters' ) }
			/>
		</div>,
		mountNode
	);
}

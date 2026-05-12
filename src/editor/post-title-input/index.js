/* globals newspack_email_editor_data */
/**
 * WordPress dependencies
 */
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { PanelBody, TextControl, TextareaControl } from '@wordpress/components';
import { ENTER } from '@wordpress/keycodes';
import { __ } from '@wordpress/i18n';

const CANVAS_IFRAME_SELECTOR = 'iframe[name="editor-canvas"]';
const WRAPPER_SELECTOR = '.editor-visual-editor__post-title-wrapper';
const MOUNT_CLASSNAME = 'newspack-newsletters-post-title-mount';

const isNewsletterCpt = newspack_email_editor_data?.newsletter_post_type === newspack_email_editor_data?.current_post_type;

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
	const subjectRef = useRef( null );
	const focusedRef = useRef( false );
	const entityConverter = useRef( null );

	const { title, previewText, isCleanNewPost } = useSelect( select => {
		const editor = select( editorStore );
		const meta = editor.getEditedPostAttribute( 'meta' ) || {};
		return {
			title: editor.getEditedPostAttribute( 'title' ) || '',
			previewText: meta.preview_text || '',
			isCleanNewPost: editor.isCleanNewPost(),
		};
	}, [] );
	const { editPost } = useDispatch( editorStore );
	const { insertDefaultBlock } = useDispatch( blockEditorStore );

	const [ mountNode, setMountNode ] = useState( null );
	const [ plainTextTitle, setPlainTextTitle ] = useState( null );

	// HTML-entity round-trip via a detached textarea, mirroring the previous
	// sidebar control so titles like `Bob &amp; Alice` display as `Bob & Alice`
	// in the plain-text input and serialise back the same way on save.
	useEffect( () => {
		if ( ! entityConverter.current ) {
			entityConverter.current = document.createElement( 'textarea' );
		}
		return () => {
			entityConverter.current = null;
		};
	}, [] );

	useEffect( () => {
		if ( ! entityConverter.current ) {
			return;
		}
		entityConverter.current.innerHTML = title;
		setPlainTextTitle( entityConverter.current.value );
	}, [ title ] );

	useEffect( () => {
		if ( plainTextTitle === null || ! entityConverter.current ) {
			return;
		}
		entityConverter.current.innerText = plainTextTitle;
		const encoded = entityConverter.current.innerHTML;
		if ( encoded !== title ) {
			editPost( { title: encoded } );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ plainTextTitle ] );

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
		if ( focusedRef.current || ! subjectRef.current || ! isCleanNewPost ) {
			return;
		}
		const { activeElement, body } = subjectRef.current.ownerDocument;
		if ( ! activeElement || body === activeElement ) {
			subjectRef.current.focus();
			focusedRef.current = true;
		}
	}, [ isCleanNewPost, mountNode ] );

	if ( ! mountNode ) {
		return null;
	}

	const onSubjectKeyDown = event => {
		if ( event.keyCode === ENTER ) {
			event.preventDefault();
			insertDefaultBlock( undefined, undefined, 0 );
		}
	};

	const subjectLabel = isNewsletterCpt ? __( 'Subject', 'newspack-newsletters' ) : __( 'Title', 'newspack-newsletters' );
	const panelTitle = isNewsletterCpt ? __( 'Email details', 'newspack-newsletters' ) : __( 'Layout details', 'newspack-newsletters' );

	return createPortal(
		<div className="newspack-newsletters-post-title">
			<PanelBody className="newspack-newsletters-post-title__panel" title={ panelTitle } initialOpen={ true }>
				<div className="newspack-newsletters-post-title__fields">
					<TextControl
						ref={ subjectRef }
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ subjectLabel }
						value={ plainTextTitle ?? '' }
						onChange={ setPlainTextTitle }
						onKeyDown={ onSubjectKeyDown }
					/>
					{ isNewsletterCpt && (
						<TextareaControl
							__nextHasNoMarginBottom
							label={ __( 'Preview text', 'newspack-newsletters' ) }
							value={ previewText }
							onChange={ value => editPost( { meta: { preview_text: value } } ) }
							rows={ 2 }
						/>
					) }
				</div>
			</PanelBody>
		</div>,
		mountNode
	);
}

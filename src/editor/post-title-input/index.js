/* globals newspack_email_editor_data */
/**
 * WordPress dependencies
 */
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { store as blockEditorStore } from '@wordpress/block-editor';
import {
	TextControl,
	TextareaControl,
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
} from '@wordpress/components';
import { ENTER } from '@wordpress/keycodes';
import { __ } from '@wordpress/i18n';

const CANVAS_IFRAME_SELECTOR = 'iframe[name="editor-canvas"]';
const POST_TITLE_WRAPPER_SELECTOR = '.editor-visual-editor__post-title-wrapper';
const VISUAL_EDITOR_SELECTOR = '.edit-post-visual-editor, .editor-visual-editor';
const MOUNT_CLASSNAME = 'newspack-newsletters-post-title-mount';

const isNewsletterCpt = newspack_email_editor_data?.newsletter_post_type === newspack_email_editor_data?.current_post_type;

function getCanvasDocument() {
	const iframe = document.querySelector( CANVAS_IFRAME_SELECTOR );
	return iframe?.contentDocument?.body ? iframe.contentDocument : null;
}

// Mount in admin chrome above the canvas — @wordpress/components emotion styles don't reach the iframe.
function placeMount() {
	const existing = document.querySelector( `.${ MOUNT_CLASSNAME }` );
	const visualEditor = document.querySelector( VISUAL_EDITOR_SELECTOR );
	if ( ! visualEditor?.parentNode ) {
		return existing || null;
	}
	const mount = existing || document.createElement( 'div' );
	if ( ! existing ) {
		mount.className = MOUNT_CLASSNAME;
	}
	if ( mount.nextSibling !== visualEditor ) {
		visualEditor.parentNode.insertBefore( mount, visualEditor );
	}
	return mount;
}

function removeCanvasPostTitle( canvasDoc ) {
	canvasDoc?.querySelector( POST_TITLE_WRAPPER_SELECTOR )?.remove();
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

	// HTML-entity round-trip via detached textarea (e.g. `Bob &amp; Alice` ↔ `Bob & Alice`).
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

		const syncMount = () => {
			const next = placeMount();
			setMountNode( prev => ( prev === next ? prev : next ) );
		};

		// Iframe mutations don't bubble to the parent doc, so we need an inner observer.
		const attachCanvas = doc => {
			canvasObserver?.disconnect();
			canvasObserver = null;
			canvasDoc = doc;
			if ( ! doc?.body ) {
				return;
			}
			removeCanvasPostTitle( doc );
			canvasObserver = new MutationObserver( () => removeCanvasPostTitle( doc ) );
			canvasObserver.observe( doc.body, { childList: true, subtree: true } );
		};

		syncMount();
		attachCanvas( getCanvasDocument() );

		const parentObserver = new MutationObserver( () => {
			syncMount();
			const nextDoc = getCanvasDocument();
			if ( nextDoc !== canvasDoc ) {
				attachCanvas( nextDoc );
			}
		} );
		parentObserver.observe( document.body, { childList: true, subtree: true } );

		return () => {
			parentObserver.disconnect();
			canvasObserver?.disconnect();
			document.querySelector( `.${ MOUNT_CLASSNAME }` )?.remove();
		};
	}, [] );

	// Mirror Gutenberg's behaviour of focusing the title on a fresh, empty post.
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

	return createPortal(
		<VStack className="newspack-newsletters-post-title__fields" spacing={ 4 }>
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
					help={ __(
						'Shown in the inbox after the subject line. Around 50–100 characters works best across email clients.',
						'newspack-newsletters'
					) }
					value={ previewText }
					onChange={ value => editPost( { meta: { preview_text: value } } ) }
					rows={ 2 }
				/>
			) }
		</VStack>,
		mountNode
	);
}

/**
 * External dependencies
 */
import { pick, omit, includes } from 'lodash';
import mjml2html from 'mjml-browser';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { select as globalSelect } from '@wordpress/data';

const POST_META_WHITELIST = [
	'is_public',
	'preview_text',
	'disable_auto_ads',
	'font_body',
	'font_header',
	'background_color',
	'custom_css',
	'newsletter_sent',
];

/**
 * Use a middleware to hijack the post update request.
 * When a post is about to be updated, first the email-compliant HTML has
 * to be produced. To do that, MJML (more at mjml.io) is used.
 */
apiFetch.use( async ( options, next ) => {
	const { method, path, data = {} } = options;

	// Only run in update request.
	if ( method !== 'POST' && method !== 'PUT' ) {
		return next( options );
	}

	// Only run if the update contains the newsletter content.
	if ( ! data.content || ! data.id ) {
		return next( options );
	}

	const mjmlHandlingPostTypes = window.newspack_email_editor_data.mjml_handling_post_types;

	// Only run if the request is for a post type that is handled by MJML.
	if ( ! mjmlHandlingPostTypes.some( postType => path.indexOf( postType ) !== -1 ) ) {
		return next( options );
	}

	const editorSelector = globalSelect( 'core/editor' );
	const postType = editorSelector.getCurrentPostType();

	// Only run if the current post type is allowed to be handled by MJML.
	if ( ! includes( mjmlHandlingPostTypes, postType ) ) {
		return next( options );
	}

	const emailHTMLMetaName = window.newspack_email_editor_data.email_html_meta;
	// Strip the meta which will be updated explicitly from post update payload.
	if ( options.data.meta ) {
		options.data.meta = omit( options.data.meta, [ ...POST_META_WHITELIST, emailHTMLMetaName ] );
	}

	// First, save post meta. It is not saved when saving a draft, so
	// it's saved here in order for the backend to have access to these.
	const postMeta = editorSelector.getEditedPostAttribute( 'meta' );
	await apiFetch( {
		data: { meta: pick( postMeta, POST_META_WHITELIST ) },
		method: 'POST',
		path: `/wp/v2/${ postType }/${ data.id }`,
	} );

	// Then, send the content over to the server to convert the post content
	// into MJML markup.
	const { mjml } = await apiFetch( {
		path: `/newspack-newsletters/v1/post-mjml`,
		method: 'POST',
		data: {
			post_id: data.id,
			title: data.title,
			content: data.content,
		},
	} );

	// Once received MJML markup, convert it to email-compliant HTML
	// and save as post meta for later retrieval.
	const { html } = mjml2html( mjml, { keepComments: false, minify: true } );
	await apiFetch( {
		data: { meta: { [ emailHTMLMetaName ]: html } },
		method: 'POST',
		path: `/wp/v2/${ postType }/${ data.id }`,
	} );

	return next( options ); // Proceed with the post update request.
} );

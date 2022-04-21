/**
 * External dependencies
 */
import { pick, omit, includes } from 'lodash';
import mjml2html from 'mjml-browser';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { dispatch as globalDispatch, select as globalSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { NEWSLETTER_CPT_SLUG } from '../../utils/consts';

const POST_META_WHITELIST = [
	'is_public',
	'preview_text',
	'diable_ads',
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
	if (
		path.indexOf( NEWSLETTER_CPT_SLUG ) > 0 &&
		data.content &&
		data.id &&
		( method === 'POST' || method === 'PUT' )
	) {
		const emailHTMLMetaName = window.newspack_email_editor_data.email_html_meta;
		const mjmlHandlingPostTypes = window.newspack_email_editor_data.mjml_handling_post_types;
		const editorSelector = globalSelect( 'core/editor' );
		const postType = editorSelector.getCurrentPostType();
		if ( ! includes( mjmlHandlingPostTypes, postType ) ) {
			return next( options );
		}

		// Strip the meta which will be updated explicitly from post update payload.
		options.data.meta = omit( options.data.meta, [ ...POST_META_WHITELIST, emailHTMLMetaName ] );

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
		return apiFetch( {
			path: `/newspack-newsletters/v1/post-mjml`,
			method: 'POST',
			data: {
				post_id: data.id,
				title: data.title,
				content: data.content,
			},
		} )
			.then( ( { mjml } ) => {
				// Once received MJML markup, convert it to email-compliant HTML
				// and save as post meta for later retrieval.
				const { html } = mjml2html( mjml, { keepComments: false, minify: true } );
				return apiFetch( {
					data: { meta: { [ emailHTMLMetaName ]: html } },
					method: 'POST',
					path: `/wp/v2/${ postType }/${ data.id }`,
				} );
			} )
			.then( () => next( options ) ) // Proceed with the post update request.
			.catch( error => {
				// In case of an error, display notice and proceed with the post update request.
				const { createErrorNotice } = globalDispatch( 'core/notices' );
				createErrorNotice( error.message || __( 'Something went wrong', 'newspack-newsletters' ) );
				return next( options );
			} );
	}
	return next( options );
} );

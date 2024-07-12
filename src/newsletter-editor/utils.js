/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { getServiceProvider } from '../service-providers';

/**
 * External dependencies
 */
import mjml2html from 'mjml-browser';

export const getEditPostPayload = newsletterData => {
	return {
		meta: {
			newsletterData,
		},
	};
};

export const validateNewsletter = newsletterData => {
	const { validateNewsletter: validate } = getServiceProvider();
	if ( ! validate ) {
		return [];
	}
	return validate( newsletterData );
};

/**
 * Test if a string contains valid email addresses.
 *
 * @param {string} string String to test.
 * @return {boolean} True if it contains a valid email string.
 */
export const hasValidEmail = string => /\S+@\S+/.test( string );

/**
 * Refresh the email-compliant HTML for a post.
 *
 * @param {number} postId      The current post ID.
 * @param {string} postTitle   The current post title.
 * @param {string} postContent The current post content.
 * @return {Promise<string>} The refreshed email HTML.
 */
export const refreshEmailHtml = async ( postId, postTitle, postContent ) => {
	const mjml = await apiFetch( {
		path: `/newspack-newsletters/v1/post-mjml`,
		method: 'POST',
		data: {
			post_id: postId,
			title: postTitle,
			content: postContent,
		},
	} );

	// Once received MJML markup, convert it to email-compliant HTML and save as post meta.
	const { html } = mjml2html( mjml, { keepComments: false, minify: true } );
	return html;
};

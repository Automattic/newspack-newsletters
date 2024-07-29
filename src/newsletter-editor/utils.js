/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';

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

/**
 * Get a label for the Send To autocomplete field.
 *
 * @param {Object} item A list or sublist item.
 * @return {string} The autocomplete suggestion label for the item.
 */
export const getSuggestionLabel = item => {
	return sprintf(
		// Translators: %1$s is the item type, %2$s is the item name, %3$s is more details about the item, if available.
		__( '[%1$s] %2$s %3$s', 'newspack-newsletters' ),
		item.typeLabel,
		item.name,
		item?.count && null !== item?.count
			? sprintf(
					// Translators: %d is the number of contacts in the list.
					_n( '(%d contact)', '(%d contacts)', item.count, 'newspack-newsletters' ),
					item.count
			  )
			: ''
	).trim();
};

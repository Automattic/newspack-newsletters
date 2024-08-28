/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';

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

/**
 * Validation utility.
 *
 * @param {Object} meta              Post meta.
 * @param {string} meta.senderEmail  Sender email address.
 * @param {string} meta.senderName   Sender name.
 * @param {string} meta.send_list_id Send-to list ID.
 * @return {string[]} Array of validation messages. If empty, newsletter is valid.
 */
export const validateNewsletter = ( meta = {} ) => {
	const { senderEmail, senderName, send_list_id: listId } = meta;
	const messages = [];
	if ( ! senderEmail || ! senderName ) {
		messages.push( __( 'Missing required sender info.', 'newspack-newsletters' ) );
	}
	if ( ! listId ) {
		messages.push( __( 'Missing required list.', 'newspack-newsletters' ) );
	}
	return messages;
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
 * Format: [ITEM TYPE] Item Name (contact count)
 *
 * @param {Object} item A list or sublist item.
 * @return {string} The autocomplete suggestion label for the item.
 */
export const getSuggestionLabel = item => {
	const contactCount =
		item?.count && null !== item?.count
			? sprintf(
					// Translators: If available, show a contact count alongside the suggested item. %d is the number of contacts in the suggested item.
					_n( '(%d contact)', '(%d contacts)', item.count, 'newspack-newsletters' ),
					item.count
			  )
			: '';
	return `[${ item.entity_type.toUpperCase() }] ${ item.name } ${ contactCount }`.trim();
};

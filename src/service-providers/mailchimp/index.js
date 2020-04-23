/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import ProviderSidebar from './ProviderSidebar';

const validateNewsletter = ( { campaign } ) => {
	const { recipients, settings, status } = campaign || {};
	const { list_id: listId } = recipients || {};
	const { from_name: senderName, reply_to: senderEmail } = settings || {};

	const messages = [];
	if ( 'sent' === status || 'sending' === status ) {
		messages.push( __( 'Newsletter has already been sent.', 'newspack-newsletters' ) );
	}
	if ( ! listId ) {
		messages.push(
			__( 'A Mailchimp list must be selected before publishing.', 'newspack-newsletters' )
		);
	}
	if ( ! senderName || senderName.length < 1 ) {
		messages.push( __( 'Sender name must be set.', 'newspack-newsletters' ) );
	}
	if ( ! senderEmail || senderEmail.length < 1 ) {
		messages.push( __( 'Sender email must be set.', 'newspack-newsletters' ) );
	}

	return messages;
};

const getEmailPreviewURL = ( { campaign } ) => campaign && campaign.long_archive_url;

const getFetchDataConfig = ( { postId } ) => ( {
	path: `/newspack-newsletters/v1/mailchimp/${ postId }`,
} );

export default {
	validateNewsletter,
	getEmailPreviewURL,
	getFetchDataConfig,
	ProviderSidebar,
};

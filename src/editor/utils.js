/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

const validateCampaign = campaign => {
	const { recipients, settings, status } = campaign || {};
	const { list_id: listId } = recipients || {};
	const { from_name: senderName, reply_to: senderEmail } = settings || {};

	const messages = [];
	if ( 'sent' === status || 'sending' === status ) {
		messages.push( __( 'Newsletter has already been sent', 'newspack-newsletters' ) );
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

export const getEditPostPayload = campaign => ( {
	meta: {
		// This meta field does not have to be registered on the back end,
		// as it is not used there.
		campaign_validation_errors: validateCampaign( campaign ),
	},
} );

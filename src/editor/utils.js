/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { get, find } from 'lodash';

const validateCampaign = campaign => {
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

export const getEditPostPayload = ( {
	campaign,
	interest_categories: interestCategories,
	lists,
} ) => ( {
	meta: {
		// These meta fields do not have to be registered on the back end,
		// as they are not used there.
		campaignValidationErrors: validateCampaign( campaign ),
		campaign,
		interestCategories,
		lists,
	},
} );

/**
 * Test if a string contains valid email addresses.
 *
 * @param  {string}  string String to test.
 * @return {boolean} True if it contains a valid email string.
 */
export const hasValidEmail = string => /\S+@\S+/.test( string );

/**
 * Get interest settings for a Mailchimp campaign.
 * An interest is a subset of a list.
 */
export const getListInterestsSettings = ( { campaign, interestCategories } ) => {
	if (
		! interestCategories ||
		! interestCategories.categories ||
		! interestCategories.categories.length
	) {
		return;
	}
	const options = interestCategories.categories.reduce( ( accumulator, item ) => {
		const { title, interests, id } = item;
		accumulator.push( {
			label: title,
			disabled: true,
		} );
		if ( interests && interests.interests && interests.interests.length ) {
			interests.interests.forEach( interest => {
				const isDisabled = parseInt( interest.subscriber_count ) === 0;
				accumulator.push( {
					label:
						'- ' +
						interest.name +
						( isDisabled ? __( ' (no subscribers)', 'newspack-newsletters' ) : '' ),
					value: 'interests-' + id + ':' + interest.id,
					disabled: isDisabled,
					rawInterest: interest,
				} );
			} );
		}
		return accumulator;
	}, [] );
	const field = get( campaign, 'recipients.segment_opts.conditions.[0].field' );
	const interest_id = get( campaign, 'recipients.segment_opts.conditions.[0].value.[0]' );
	const interestValue = field && interest_id ? field + ':' + interest_id : 0;

	return { options, interestValue, setInterest: find( options, [ 'value', interestValue ] ) };
};

/**
 * WordPress dependencies
 */
import { __, sprintf, _n } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { ProviderSidebar } from './ProviderSidebar';

const hasOauth = true;

const validateNewsletter = ( { campaign } ) => {
	const messages = [];

	// Exit early if campaign is not set
	if ( ! campaign ) {
		return [ __( 'Not connected to Constant Contact', 'newspack-newsletters' ) ];
	}

	if ( 'DRAFT' !== campaign.current_status ) {
		messages.push( __( 'Newsletter has already been sent.', 'newspack-newsletters' ) );
	}
	if ( ! campaign?.activity?.contact_list_ids?.length ) {
		messages.push(
			__(
				'At least one Constant Contact list must be selected before publishing.',
				'newspack-newsletters'
			)
		);
	}
	return messages;
};

const renderPreSendInfo = newsletterData => {
	if ( ! newsletterData.campaign ) {
		return null;
	}
	const campaignLists = newsletterData.lists.filter(
		( { list_id } ) =>
			newsletterData.campaign?.activity?.contact_list_ids?.indexOf( list_id ) !== -1
	);
	const subscriberCount = campaignLists.reduce(
		( total, list ) => total + list.membership_count,
		0
	);

	return (
		<p>
			{ __( "You're sending a newsletter to:", 'newspack-newsletters' ) }
			<br />
			<strong>{ campaignLists.map( list => list.name ).join( ', ' ) }</strong>
			<br />
			<strong>
				{ sprintf(
					// Translators: subscriber count help message.
					_n( '%d subscriber', '%d subscribers', subscriberCount, 'newspack-newsletters' ),
					subscriberCount
				) }
			</strong>
		</p>
	);
};

export default {
	hasOauth,
	validateNewsletter,
	ProviderSidebar,
	renderPreSendInfo,
};

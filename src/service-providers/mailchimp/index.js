/**
 * WordPress dependencies
 */
import { __, sprintf, _n } from '@wordpress/i18n';
import { Fragment } from '@wordpress/element';

/**
 * External dependencies
 */
import { find } from 'lodash';

/**
 * Internal dependencies
 */
import { ProviderSidebar } from './ProviderSidebar';

/**
 * Validation utility.
 *
 * @param {Object} meta              Post meta.
 * @param {string} meta.senderEmail  Sender email address.
 * @param {string} meta.senderName   Sender name.
 * @param {string} meta.send_list_id Send-to list ID.
 * @return {string[]} Array of validation messages. If empty, newsletter is valid.
 */
const validateNewsletter = ( meta = {} ) => {
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

const renderPreSendInfo = newsletterData => {
	if ( ! newsletterData.campaign ) {
		return null;
	}
	let listData;
	if ( newsletterData.campaign && newsletterData.lists ) {
		const lists = newsletterData.lists || [];
		const list = find( lists, [ 'id', newsletterData.campaign.recipients.list_id ] );
		if ( list ) {
			listData = {
				name: list.name,
				subscribers: parseInt( newsletterData.campaign.recipients.recipient_count ),
			};
		}
	}

	if ( ! listData ) {
		return null;
	}

	return (
		<p>
			{ __( "You're sending a newsletter to:", 'newspack-newsletters' ) }
			<br />
			<strong>{ listData.name }</strong>
			<br />
			{ listData.groupName && (
				<Fragment>
					{ __( 'Group:', 'newspack-newsletters' ) } <strong>{ listData.groupName }</strong>
					<br />
				</Fragment>
			) }
			<strong>
				{ sprintf(
					// Translators: subscriber count help message.
					_n( '%d subscriber', '%d subscribers', listData.subscribers, 'newspack-newsletters' ),
					listData.subscribers
				) }
			</strong>
		</p>
	);
};

const isCampaignSent= ( newsletterData, postStatus = 'draft' ) => {
	const { status } = newsletterData?.campaign || {};
	if ( 'sent' === status || 'sending' === status ) {
		return true;
	}
	if ( 'publish' === postStatus || 'private' === postStatus ) {
		return true;
	}
	return false;
}

export default {
	validateNewsletter,
	ProviderSidebar,
	renderPreSendInfo,
	isCampaignSent
};

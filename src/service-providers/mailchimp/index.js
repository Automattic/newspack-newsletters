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

/**
 * Utility to render newsletter campaign info in the pre-send confirmation modal.
 *
 * @param {Object} newsletterData          Data returned from the ESP retrieve method.
 * @param {Object} newsletterData.campaign Campaign data returned from the ESP retrieve method.
 * @param {Object} newsletterData.lists    Available send lists.
 * @param {Object} newsletterData.sublists Available send sublists.
 * @param {Object} meta                    Post meta.
 * @param {string} meta.send_list_id       Send-to list ID.
 * @param {string} meta.send_sublist_id    Send-to sublist ID.
 */
const renderPreSendInfo = ( newsletterData = {}, meta = {} ) => {
	const { campaign, lists = [], sublists = [] } = newsletterData;
	const { send_list_id: listId, send_sublist_id: sublistId } = meta;
	if ( ! campaign || ! listId ) {
		return null;
	}
	let listData, sublistData, subscriberCount;
	if ( campaign?.recipients?.list_id && campaign.recipients.list_id === listId ) {
		const list = find( lists, [ 'id', listId ] );
		if ( list ) {
			listData = list;
		}
		const sublist = find( sublists, [ 'id', sublistId.toString() ] );
		if ( sublist ) {
			sublistData = sublist;
		}
		if ( campaign?.recipients?.recipient_count ) {
			subscriberCount = parseInt( campaign.recipients.recipient_count );
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
			{ sublistData && (
				<>
					{ sublistData.entity_type.charAt(0).toUpperCase() + sublistData.entity_type.slice(1) + ': '}
					<strong>{ sublistData.name }</strong>
					<br />
				</>
			) }
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

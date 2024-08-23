/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Spinner } from '@wordpress/components';
import { Fragment } from '@wordpress/element';

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
 * A function to render additional info in the pre-send confirmation modal.
 * Can return null if no additional info is to be presented.
 * TODO: handle meta sender/send_to info in this function
 *
 * @param {Object} newsletterData the data returned from the ESP retrieve method
 * @return {any} A React component
 */
const renderPreSendInfo = ( newsletterData = {} ) => {
	const { list_id, segment_id, lists, segments } = newsletterData;

	if ( ! lists?.length ) {
		return <Spinner />;
	}

	const list = lists.find( thisList => list_id === thisList.id );
	const segment = segments?.find( thisSegment => segment_id === thisSegment.id );

	if ( ! list ) {
		return null;
	}

	return (
		<Fragment>
			<p>
				{ __(
					'You’re about to send an ActiveCampaign newsletter to the following list:',
					'newspack-newsletters'
				) }{ ' ' }
				<strong>{ list.name }</strong>
				{ segment && (
					<>
						{ __( ', segmented to:', 'newspack-newsletters' ) } <strong>{ segment.name }</strong>
					</>
				) }
			</p>
			<p>{ __( 'Are you sure you want to proceed?', 'newspack-newsletters' ) }</p>
		</Fragment>
	);
};

const isCampaignSent= ( newsletterData, postStatus = 'draft' ) => {
	if ( 'publish' === postStatus || 'private' === postStatus ) {
		return true;
	}
	return false;
}

export default {
	validateNewsletter,
	renderPreSendInfo,
	isCampaignSent
};

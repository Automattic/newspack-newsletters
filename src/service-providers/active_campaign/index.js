/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Spinner } from '@wordpress/components';
import { Fragment } from '@wordpress/element';

/**
 * Validation utility.
 *
 * @param {Object} newsletterData Data returned from the ESP retrieve method.
 * @param {Object} meta           Post meta.
 * @param {string} meta.sender    Sender info.
 * @param {string} meta.send_to   Send-to info.
 * @return {string[]} Array of validation messages. If empty, newsletter is valid.
 */
const validateNewsletter = ( newsletterData, meta = {} ) => {
	const { sender, send_to: sendTo } = meta;
	const messages = [];
	if ( ! sender?.name || ! sender?.email ) {
		messages.push( __( 'Missing required sender info.', 'newspack-newsletters' ) );
	}
	if ( ! sendTo?.list?.id ) {
		messages.push( __( 'Must select a list when sending in list mode', 'newspack-newsletters' ) );
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

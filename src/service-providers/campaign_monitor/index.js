/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import ProviderSidebar from './ProviderSidebar';

/**
 * Validation utility.
 *
 * @param  {Object} object data fetched using getFetchDataConfig
 * @return {string[]} Array of validation messages. If empty, newsletter is valid.
 */
const validateNewsletter = ( { status } ) => {
	const messages = [];
	if ( 'sent' === status || 'sending' === status ) {
		messages.push( __( 'Newsletter has already been sent.', 'newspack-newsletters' ) );
	}

	return messages;
};

/**
 * Get config used to fetch newsletter data.
 * Should return apiFetch utility config:
 * https://www.npmjs.com/package/@wordpress/api-fetch
 *
 * @param {Object} object data to contruct the config.
 * @return {Object} Config fetching.
 */
const getFetchDataConfig = ( { postId } ) => ( {
	path: `/newspack-newsletters/v1/campaign_monitor/${ postId }/retrieve`,
} );

/**
 * A function to render additional info in the pre-send confirmation modal.
 * Can return null if no additional info is to be presented.
 *
 * @param {Object} newsletterData the data returned by getFetchDataConfig handler
 * @return {any} A React component
 */
const renderPreSendInfo = ( newsletterData = {} ) => (
	<p>
		{ __( 'Sending newsletter to:', 'newspack-newsletters' ) } { newsletterData.listName }
	</p>
);

export default {
	validateNewsletter,
	getFetchDataConfig,
	ProviderSidebar,
	renderPreSendInfo,
};

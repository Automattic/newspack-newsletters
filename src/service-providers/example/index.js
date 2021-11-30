/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment } from '@wordpress/element';

/**
 * @type {boolean} Whether the ESP requires OAuth authentication.
 */
const hasOauth = false;

/**
 * Validation utility.
 *
 * @param {Object} data Data fetched using getFetchDataConfig
 * @param {string} data.status Status of the newsletter being validated.
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
 * @param {Object} data Data to contruct the config.
 * @param {number} data.postId Post ID.
 * @return {Object} Config fetching.
 */
const getFetchDataConfig = ( { postId } ) => ( {
	path: `/newspack-newsletters/v1/example/${ postId }`,
} );

/**
 * Component to be rendered in the sidebar panel.
 * Has full control over the panel contents rendering,
 * so that it's possible to render e.g. a loader while
 * the data is not yet available.
 *
 * @param {Object} props Component props.
 * @param {number} props.postId ID of the edited newsletter post.
 * @param {Function} props.apiFetch Fetching handler. Receives config for @wordpress/api-fetch as argument.
 * @param {Function} props.renderSubject Function that renders email subject input.
 * @param {Function} props.renderFrom Function that renders from inputs - sender name and email.
 *                                    Has to receive an object with `handleSenderUpdate` function,
 *                                    which will receive a `{senderName, senderEmail}` object – so that
 *                                    the data can be sent to the backend.
 * @param {Function} props.renderPreviewText Function that renders preview text input
 */
const ProviderSidebar = ( { postId, apiFetch, renderSubject, renderFrom, renderPreviewText } ) => {
	const handleSenderUpdate = ( { senderName, senderEmail } ) =>
		apiFetch( {
			path: `/newspack-newsletters/v1/example/${ postId }/sender`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		} );

	return (
		<Fragment>
			{ renderSubject() }
			{ renderFrom( { handleSenderUpdate } ) }
			{ renderPreviewText() }
		</Fragment>
	);
};

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
	hasOauth,
	validateNewsletter,
	getFetchDataConfig,
	ProviderSidebar,
	renderPreSendInfo,
};

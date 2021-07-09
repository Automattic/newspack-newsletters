/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment } from '@wordpress/element';

/**
 * Internal dependencies
 */
import CopyHTML from '../../components/copy-html';

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
 * Component to be rendered in the sidebar panel.
 * Has full control over the panel contents rendering,
 * so that it's possible to render e.g. a loader while
 * the data is not yet available.
 *
 * @param {Object} props props
 */
const ProviderSidebar = ( { renderSubject, renderPreviewText } ) => {
	return (
		<Fragment>
			{ renderSubject() }
			{ renderPreviewText() }
		</Fragment>
	);
};

const renderPreSendInfo = () => {
	return (
		<Fragment>
			<p>
				{ __(
					'Copy the HTML code below to manually publish your newsletter with your provider.',
					'newspack-newsletters'
				) }
			</p>
			<CopyHTML />
		</Fragment>
	);
};

const renderPostUpdateInfo = () => {
	return (
		<Fragment>
			<p>
				{ __(
					'Copy the HTML code below to manually publish your newsletter with your provider.',
					'newspack-newsletters'
				) }
			</p>
			<CopyHTML />
		</Fragment>
	);
};

export default {
	validateNewsletter,
	ProviderSidebar,
	renderPreSendInfo,
	renderPostUpdateInfo,
};

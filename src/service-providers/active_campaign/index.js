/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Spinner } from '@wordpress/components';
import { Fragment } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { ProviderSidebar, validateNewsletter } from './ProviderSidebar';

/**
 * Get config used to fetch newsletter data.
 * Should return apiFetch utility config:
 * https://www.npmjs.com/package/@wordpress/api-fetch
 *
 * @param {Object} data        Data to contruct the config.
 * @param {number} data.postId Post ID.
 * @return {Object} Config fetching.
 */
const getFetchDataConfig = ( { postId } ) => ( {
	path: `/newspack-newsletters/v1/active_campaign/${ postId }/retrieve`,
} );

/**
 * A function to render additional info in the pre-send confirmation modal.
 * Can return null if no additional info is to be presented.
 *
 * @param {Object} newsletterData the data returned by getFetchDataConfig handler
 * @return {any} A React component
 */
const renderPreSendInfo = ( newsletterData = {} ) => {
	const { list_id, segment_id, lists, segments } = newsletterData;

	if ( ! lists?.length ) {
		return <Spinner />;
	}

	const list = lists.find( thisList => list_id === thisList.id );
	const segment = segments?.find( thisSegment => segment_id === thisSegment.id );

	if ( ! list ) return null;

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
						{ __( ', segmented to: ', 'newspack-newsletters' ) }
						<strong> { segment.name }</strong>
					</>
				) }
			</p>
			<p>{ __( 'Are you sure you want to proceed?', 'newspack-newsletters' ) }</p>
		</Fragment>
	);
};

export default {
	validateNewsletter,
	getFetchDataConfig,
	ProviderSidebar,
	renderPreSendInfo,
};

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import { Fragment, useEffect } from '@wordpress/element';
import { SelectControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useNewsletterData } from '../../newsletter-editor/store';

const ProviderSidebarComponent = ( {
	renderFrom,
	inFlight,
	postId,
	updateMeta,
} ) => {
	const newsletterData = useNewsletterData();
	const { campaign, folders } = newsletterData;

	const getFolderOptions = () => {
		const options = folders.map( folder => ( {
			label: folder.name,
			value: folder.id,
		} ) );
		options.unshift( {
			label: campaign?.settings?.folder_id ? __( 'Can’t unset folder', 'newspack-newsletters' ) : __( 'No folder', 'newspack-newsletters' ),
			value: '',
			disabled: !! campaign?.settings?.folder_id,
		} );
		return options;
	};

	const setFolder = folder_id =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/folder`,
			method: 'POST',
			data: {
				folder_id,
			},
		} );

	const setSender = ( { senderName, senderEmail } ) =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/sender`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		} );

	useEffect( () => {
		if ( campaign && campaign.settings ) {
			const { from_name, reply_to } = campaign.settings;
			updateMeta( {
				...( from_name
					? {
						senderName: from_name,
					} : {} ),
				...( reply_to
					? {
						senderEmail: reply_to,
					} : {} ),
			} );
		}
	}, [ campaign ] );

	return (
		<Fragment>
			<SelectControl
				label={ __( 'Campaign Folder', 'newspack-newsletters' ) }
				value={ campaign?.settings?.folder_id }
				options={ getFolderOptions() }
				onChange={ setFolder }
				disabled={ inFlight || ! folders.length }
			/>
			<hr />
			{ renderFrom( { handleSenderUpdate: setSender } ) }
		</Fragment>
	);
};

const mapStateToProps = select => {
	const { getEditedPostAttribute } = select( 'core/editor' );
	return {
		meta: getEditedPostAttribute( 'meta' ),
	};
};

export const ProviderSidebar = compose( [ withSelect( mapStateToProps ) ] )(
	ProviderSidebarComponent
);

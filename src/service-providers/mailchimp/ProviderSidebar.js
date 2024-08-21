/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { SelectControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useNewsletterData } from '../../newsletter-editor/store';

export const ProviderSidebar = ( {
	inFlight,
	postId,
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

	return (
		<>
			<SelectControl
				label={ __( 'Campaign Folder', 'newspack-newsletters' ) }
				value={ campaign?.settings?.folder_id }
				options={ getFolderOptions() }
				onChange={ setFolder }
				disabled={ inFlight || ! folders.length }
			/>
		</>
	);
};

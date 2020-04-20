/**
 * External dependencies
 */
import { WebPreview } from 'newspack-components';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { withSelect } from '@wordpress/data';
import { PluginPostStatusInfo } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import { Button } from '@wordpress/components';

const StatusInfoPreviewButton = ( { url } ) =>
	url ? (
		<PluginPostStatusInfo>
			<WebPreview
				url={ url }
				renderButton={ ( { showPreview } ) => (
					<Button isPrimary onClick={ showPreview }>
						{ __( 'Preview', 'newspack-newsletters' ) }
					</Button>
				) }
			/>
		</PluginPostStatusInfo>
	) : null;

const StatusInfoPreviewButtonWithSelect = withSelect( select => {
	const { getEditedPostAttribute } = select( 'core/editor' );
	const meta = getEditedPostAttribute( 'meta' );
	return { url: meta.campaign && meta.campaign.long_archive_url };
} )( StatusInfoPreviewButton );

export default () => {
	registerPlugin( 'newspack-newsletters-post-status-info', {
		render: StatusInfoPreviewButtonWithSelect,
	} );
};

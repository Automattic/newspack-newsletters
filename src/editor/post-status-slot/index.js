/**
 * External dependencies
 */
import { WebPreview } from 'newspack-components';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { PluginPostStatusInfo } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';

const StatusInfoPreviewButton = ( { url, savePost } ) => {
	const [ inFlight, setInFlight ] = useState( false );
	const handleClick = showPreview => async () => {
		setInFlight( true );
		await savePost();
		showPreview();
		setInFlight( false );
	};
	return (
		<PluginPostStatusInfo>
			<WebPreview
				url={ url }
				renderButton={ ( { showPreview } ) => (
					<Button isPrimary disabled={ inFlight || ! url } onClick={ handleClick( showPreview ) }>
						{ __( 'Preview', 'newspack-newsletters' ) }
					</Button>
				) }
			/>
		</PluginPostStatusInfo>
	);
};

const StatusInfoPreviewButtonWithSelect = compose( [
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return { url: meta.campaign && meta.campaign.long_archive_url };
	} ),
	withDispatch( dispatch => {
		const { savePost } = dispatch( 'core/editor' );
		return {
			savePost,
		};
	} ),
] )( StatusInfoPreviewButton );

export default () => {
	registerPlugin( 'newspack-newsletters-post-status-info', {
		render: StatusInfoPreviewButtonWithSelect,
	} );
};

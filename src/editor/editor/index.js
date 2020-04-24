/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import { withDispatch, withSelect } from '@wordpress/data';
import { createPortal, useEffect, useState } from '@wordpress/element';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import withApiHandler from '../../components/with-api-handler';
import SendButton from '../../components/send-button';
import './style.scss';

const Editor = compose( [
	withApiHandler(),
	withSelect( select => {
		const {
			getCurrentPostId,
			getEditedPostAttribute,
			isPublishingPost,
			isSavingPost,
			isCleanNewPost,
		} = select( 'core/editor' );
		const { getActiveGeneralSidebarName } = select( 'core/edit-post' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			isCleanNewPost: isCleanNewPost(),
			postId: getCurrentPostId(),
			isReady: meta.campaignValidationErrors ? meta.campaignValidationErrors.length === 0 : false,
			activeSidebarName: getActiveGeneralSidebarName(),
			isPublishingOrSavingPost: isSavingPost() || isPublishingPost(),
		};
	} ),
	withDispatch( dispatch => {
		const { lockPostSaving, unlockPostSaving, editPost } = dispatch( 'core/editor' );
		return { lockPostSaving, unlockPostSaving, editPost };
	} ),
] )( props => {
	const [ publishEl ] = useState( document.createElement( 'div' ) );
	// Create alternate publish button
	useEffect(() => {
		const publishButton = document.getElementsByClassName(
			'editor-post-publish-button__button'
		)[ 0 ];
		publishButton.parentNode.insertBefore( publishEl, publishButton );
	}, []);
	// Fetch campaign data.
	useEffect(() => {
		if ( ! props.isCleanNewPost && ! props.isPublishingOrSavingPost ) {
			props
				.apiFetchWithErrorHandling( {
					path: `/newspack-newsletters/v1/mailchimp/${ props.postId }`,
				} )
				.then( result => {
					props.editPost( getEditPostPayload( result ) );
				} );
		}
	}, [ props.isPublishingOrSavingPost ]);

	// Lock or unlock post publishing.
	useEffect(() => {
		if ( props.isReady ) {
			props.unlockPostSaving( 'newspack-newsletters-post-lock' );
		} else {
			props.lockPostSaving( 'newspack-newsletters-post-lock' );
		}
	}, [ props.isReady ]);

	return createPortal( <SendButton />, publishEl );
} );

export default () => {
	registerPlugin( 'newspack-newsletters-edit', {
		render: Editor,
	} );
};

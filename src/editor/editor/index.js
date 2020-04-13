/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import apiFetch from '@wordpress/api-fetch';
import { withDispatch, withSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import './style.scss';

export default compose( [
	withDispatch( dispatch => {
		const { lockPostSaving, unlockPostSaving, editPost } = dispatch( 'core/editor' );
		return { lockPostSaving, unlockPostSaving, editPost };
	} ),
	withSelect( select => {
		const { getCurrentPostId, getEditedPostAttribute } = select( 'core/editor' );
		const { getActiveGeneralSidebarName } = select( 'core/edit-post' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			postId: getCurrentPostId(),
			isReady: Boolean( meta.is_ready_to_send ),
			activeSidebarName: getActiveGeneralSidebarName(),
		};
	} ),
] )( props => {
	useEffect(() => {
		// Fetch initially if the sidebar is be hidden.
		if ( props.activeSidebarName !== 'edit-post/document' ) {
			apiFetch( { path: `/newspack-newsletters/v1/mailchimp/${ props.postId }` } ).then( result => {
				props.editPost( getEditPostPayload( result.campaign ) );
			} );
		}
	}, []);

	useEffect(() => {
		if ( props.isReady ) {
			props.unlockPostSaving( 'newspack-newsletters-post-lock' );
		} else {
			props.lockPostSaving( 'newspack-newsletters-post-lock' );
		}
	}, [ props.isReady ]);

	return null;
} );

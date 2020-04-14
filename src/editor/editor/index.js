/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import apiFetch from '@wordpress/api-fetch';
import { withDispatch, withSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import './style.scss';

export default compose( [
	withDispatch( dispatch => {
		const { lockPostSaving, unlockPostSaving, editPost } = dispatch( 'core/editor' );
		return {
			lockPostSaving,
			unlockPostSaving,
			editPost,
			updateDefaultPublishButtonText: () => {
				dispatch( 'core/block-editor' ).updateSettings( {
					publishActionText: __( 'Send Campaign', 'newspack-newsletters' ),
				} );
			},
		};
	} ),
	withSelect( select => {
		const { getCurrentPostId, getEditedPostAttribute } = select( 'core/editor' );
		const { getActiveGeneralSidebarName } = select( 'core/edit-post' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			postId: getCurrentPostId(),
			isReady: ( meta.campaign_validation_errors || [] ).length === 0,
			activeSidebarName: getActiveGeneralSidebarName(),
		};
	} ),
] )( props => {
	useEffect(() => {
		props.updateDefaultPublishButtonText();
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

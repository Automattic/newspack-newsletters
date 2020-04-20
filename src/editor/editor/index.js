/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import { withDispatch, withSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import withAPIReponseHandling from '../with-api-reponse-handling';
import './style.scss';

const Editor = compose( [
	withAPIReponseHandling(),
	withSelect( select => {
		const { getCurrentPostId, getEditedPostAttribute, isPublishingPost, isSavingPost } = select(
			'core/editor'
		);
		const meta = getEditedPostAttribute( 'meta' );
		return {
			postId: getCurrentPostId(),
			isReady: meta.campaignValidationErrors ? meta.campaignValidationErrors.length === 0 : false,
			isPublishingOrSavingPost: isSavingPost() || isPublishingPost(),
		};
	} ),
	withDispatch( dispatch => {
		const { lockPostSaving, unlockPostSaving, editPost } = dispatch( 'core/editor' );
		return { lockPostSaving, unlockPostSaving, editPost };
	} ),
] )( props => {
	// Fetch campaign data.
	useEffect(() => {
		props
			.fetchAPIData( { path: `/newspack-newsletters/v1/mailchimp/${ props.postId }` } )
			.then( response => {
				props.editPost( getEditPostPayload( response ) );
			} );
	}, [ props.isPublishingOrSavingPost ]);

	// Lock or unlock post publishing.
	useEffect(() => {
		if ( props.isReady ) {
			props.unlockPostSaving( 'newspack-newsletters-post-lock' );
		} else {
			props.lockPostSaving( 'newspack-newsletters-post-lock' );
		}
	}, [ props.isReady ]);

	return null;
} );

export default () => {
	registerPlugin( 'newspack-newsletters-edit', {
		render: Editor,
	} );
};

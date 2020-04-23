/**
 * WordPress dependencies
 */
import { withDispatch, withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export default compose( [
	withDispatch( dispatch => {
		const { editPost, savePost } = dispatch( 'core/editor' );
		return { editPost, savePost };
	} ),
	withSelect( ( select, { forceIsSaving, forceIsDirty } ) => {
		const {
			getEditedPostAttribute,
			isEditedPostPublishable,
			isEditedPostSaveable,
			isSavingPost,
		} = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			isPublishable: forceIsDirty || isEditedPostPublishable(),
			isSaveable: isEditedPostSaveable(),
			isSaving: forceIsSaving || isSavingPost(),
			validationErrors: meta.campaignValidationErrors,
			status: getEditedPostAttribute( 'status' ),
		};
	} ),
] )( ( { editPost, isPublishable, isSaveable, isSaving, savePost, status, validationErrors } ) => {
	const isButtonEnabled =
		isPublishable &&
		isSaveable &&
		validationErrors &&
		! validationErrors.length &&
		'publish' !== status;
	let label;
	if ( 'publish' === status ) {
		label = isSaving
			? __( 'Sending Newsletter', 'newspack-newsletters' )
			: __( 'Sent', 'newspack-newsletters' );
	} else {
		label = __( 'Send Newsletter', 'newspack-newsletters' );
	}
	const onClick = () => {
		editPost( { status: 'publish' } );
		savePost();
	};

	return (
		<Button
			className="editor-post-publish-button"
			isBusy={ isSaving && 'publish' === status }
			isPrimary
			isLarge
			onClick={ onClick }
			disabled={ ! isButtonEnabled }
		>
			{ label }
		</Button>
	);
} );

/**
 * External dependencies
 */
import { isEqual, find } from 'lodash';

/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import { parse, serialize } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { withDispatch, withSelect } from '@wordpress/data';
import { Fragment, useState, useEffect, useMemo } from '@wordpress/element';
import { Button, Modal, TextControl, Spinner } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useLayoutsState } from '../../utils/hooks';
import { LAYOUT_CPT_SLUG } from '../../utils/consts';
import { isUserDefinedLayout } from '../../utils';
import './style.scss';
import { setPreventDeduplicationForPostsInserter } from '../../editor/blocks/posts-inserter/utils';
import NewsletterPreview from '../../components/newsletter-preview';

export default compose( [
	withSelect( select => {
		const { getEditedPostAttribute, isEditedPostEmpty, getCurrentPostId } = select( 'core/editor' );
		const { getBlocks } = select( 'core/block-editor' );
		const meta = getEditedPostAttribute( 'meta' );
		const {
			background_color,
			font_body,
			font_header,
			custom_css,
			senderEmail,
			senderName,
			send_list_id,
			send_sublist_id,
		} = meta;
		const layoutMeta = {
			background_color,
			font_body,
			font_header,
			custom_css,
		};

		// ESP-agnostic sender and send_to defaults.
		if ( senderEmail || senderName || send_list_id || send_sublist_id ) {
			layoutMeta.campaign_defaults = JSON.stringify(
				{
					senderEmail,
					senderName,
					send_list_id,
					send_sublist_id,
				}
			)
		}

		return {
			layoutId: meta.template_id,
			postTitle: getEditedPostAttribute( 'title' ),
			postBlocks: getBlocks(),
			isEditedPostEmpty: isEditedPostEmpty(),
			currentPostId: getCurrentPostId(),
			layoutMeta,
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		const { saveEntityRecord } = dispatch( 'core' );
		return {
			editPost,
			saveLayout: payload =>
				saveEntityRecord( 'postType', LAYOUT_CPT_SLUG, {
					status: 'publish',
					...payload,
				} ),
		};
	} ),
] )(
	( { editPost, layoutId, saveLayout, postBlocks, postTitle, isEditedPostEmpty, layoutMeta } ) => {
		const [ warningModalVisible, setWarningModalVisible ] = useState( false );
		const { layouts, isFetchingLayouts } = useLayoutsState();

		const [ usedLayout, setUsedLayout ] = useState( {} );

		useEffect( () => {
			setUsedLayout( find( layouts, { ID: layoutId } ) || {} );
		}, [ layouts.length ] );

		const blockPreview = useMemo( () => {
			return usedLayout.post_content ? parse( usedLayout.post_content ) : null;
		}, [ usedLayout ] );

		const [ isSavingLayout, setIsSavingLayout ] = useState( false );
		const [ isManageModalVisible, setIsManageModalVisible ] = useState( null );
		const [ newLayoutName, setNewLayoutName ] = useState( postTitle );

		const handleLayoutUpdate = updatedLayout => {
			setIsSavingLayout( false );
			// Set this new layout as the newsletter's layout
			editPost( { meta: { template_id: updatedLayout.id } } );

			// Update the layout preview
			// The shape of this data is different than the API response for CPT
			setUsedLayout( {
				...updatedLayout,
				ID: updatedLayout.id,
				post_content: updatedLayout.content.raw,
				post_title: updatedLayout.title.raw,
				post_type: LAYOUT_CPT_SLUG,
			} );
		};

		const postContent = useMemo( () => serialize( postBlocks ), [ postBlocks ] );
		const isPostContentSameAsLayout =
			postContent === usedLayout.post_content && isEqual( usedLayout.meta, layoutMeta );

		const handleSaveAsLayout = () => {
			setIsSavingLayout( true );
			const updatePayload = {
				title: newLayoutName,
				content: postContent,
				meta: layoutMeta,
			};
			saveLayout( updatePayload ).then( newLayout => {
				setIsManageModalVisible( false );
				handleLayoutUpdate( newLayout );
			} );
		};

		const handeLayoutUpdate = () => {
			if (
				// eslint-disable-next-line no-alert
				confirm( __( 'Are you sure you want to overwrite this layout?', 'newspack-newsletters' ) )
			) {
				setIsSavingLayout( true );
				const updatePayload = {
					id: usedLayout.ID,
					content: postContent,
					meta: layoutMeta,
				};
				saveLayout( updatePayload ).then( handleLayoutUpdate );
			}
		};

		const isUsingCustomLayout = isUserDefinedLayout( usedLayout );

		return (
			<Fragment>
				{ Boolean( layoutId && isFetchingLayouts ) && (
					<div className="newspack-newsletters-layouts__spinner">
						<Spinner />
					</div>
				) }
				{ blockPreview !== null && (
					<div className="newspack-newsletters-layouts">
						<div className="newspack-newsletters-layouts__item">
							<div className="newspack-newsletters-layouts__item-preview">
								<NewsletterPreview
									layoutId={ layoutId }
									meta={ usedLayout.meta }
									blocks={ setPreventDeduplicationForPostsInserter( blockPreview ) }
									viewportWidth={ 848 }
								/>
							</div>
							<div className="newspack-newsletters-layouts__item-label">
								{ usedLayout.post_title }
							</div>
						</div>
					</div>
				) }
				<div className="newspack-newsletters-buttons-group">
					<Button
						variant="secondary"
						disabled={ isEditedPostEmpty || isSavingLayout }
						onClick={ () => setIsManageModalVisible( true ) }
					>
						{ __( 'Save New Layout', 'newspack-newsletters' ) }
					</Button>

					{ isUsingCustomLayout && (
						<Button
							variant="tertiary"
							disabled={ isPostContentSameAsLayout || isSavingLayout }
							onClick={ handeLayoutUpdate }
						>
							{ __( 'Update Layout', 'newspack-newsletters' ) }
						</Button>
					) }

					<Button
						variant="secondary"
						isDestructive
						onClick={ () => setWarningModalVisible( true ) }
					>
						{ __( 'Reset Layout', 'newspack-newsletters' ) }
					</Button>
				</div>

				{ isManageModalVisible && (
					<Modal
						className="newspack-newsletters__modal"
						title={ __( 'Save newsletter as a layout', 'newspack-newsletters' ) }
						onRequestClose={ () => setIsManageModalVisible( null ) }
					>
						<TextControl
							label={ __( 'Title', 'newspack-newsletters' ) }
							disabled={ isSavingLayout }
							value={ newLayoutName }
							onChange={ setNewLayoutName }
						/>
						<Button
							isPrimary
							disabled={ isSavingLayout || newLayoutName.length === 0 }
							onClick={ handleSaveAsLayout }
						>
							{ __( 'Save', 'newspack-newsletters' ) }
						</Button>
						<Button isSecondary onClick={ () => setIsManageModalVisible( null ) }>
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
					</Modal>
				) }

				{ warningModalVisible && (
					<Modal
						className="newspack-newsletters__modal"
						title={ __( 'Overwrite newsletter content?', 'newspack-newsletters' ) }
						onRequestClose={ () => setWarningModalVisible( false ) }
					>
						<p>
							{ __(
								"Changing the newsletter's layout will remove any customizations or edits you have already made.",
								'newspack-newsletters'
							) }
						</p>
						<Button
							isPrimary
							onClick={ () => {
								editPost( { content: '', meta: { template_id: -1 } } );
								setWarningModalVisible( false );
							} }
						>
							{ __( 'Reset layout', 'newspack-newsletters' ) }
						</Button>
						<Button isSecondary onClick={ () => setWarningModalVisible( false ) }>
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
					</Modal>
				) }
			</Fragment>
		);
	}
);

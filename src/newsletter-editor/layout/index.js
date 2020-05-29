/**
 * External dependencies
 */
import { find } from 'lodash';

/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import { parse, serialize } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { BlockPreview } from '@wordpress/block-editor';
import { withDispatch, withSelect } from '@wordpress/data';
import { Fragment, useState, useEffect, useMemo } from '@wordpress/element';
import { Button, Modal, TextControl, Spinner } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useLayoutsState } from '../../utils/hooks';
import { LAYOUT_CPT_SLUG, NEWSLETTER_CPT_SLUG } from '../../utils/consts';
import { isUserDefinedLayout } from '../../utils';
import './style.scss';
import { setPreventDeduplicationForPostsInserter } from '../../editor/blocks/posts-inserter/utils';

export default compose( [
	withSelect( select => {
		const { getEditedPostAttribute, isEditedPostEmpty, getCurrentPostId } = select( 'core/editor' );
		const { getBlocks } = select( 'core/block-editor' );
		const meta = getEditedPostAttribute( 'meta' );
		const { template_id: layoutId } = meta;
		return {
			layoutId,
			postTitle: getEditedPostAttribute( 'title' ),
			getBlocks,
			isEditedPostEmpty: isEditedPostEmpty(),
			currentPostId: getCurrentPostId(),
		};
	} ),
	withDispatch( ( dispatch, { currentPostId } ) => {
		const { replaceBlocks } = dispatch( 'core/block-editor' );
		const { editPost } = dispatch( 'core/editor' );
		const { saveEntityRecord } = dispatch( 'core' );
		return {
			replaceBlocks,
			saveLayoutIdMeta: id => {
				// Edit, so the change is picked up by the selector in NewsletterEditWithSelect
				editPost( { meta: { template_id: id } } );
				saveEntityRecord( 'postType', NEWSLETTER_CPT_SLUG, {
					id: currentPostId,
					meta: { template_id: id },
				} );
			},
			saveLayout: payload =>
				saveEntityRecord( 'postType', LAYOUT_CPT_SLUG, {
					status: 'publish',
					...payload,
				} ),
		};
	} ),
] )(
	( {
		saveLayoutIdMeta,
		layoutId,
		replaceBlocks,
		saveLayout,
		getBlocks,
		postTitle,
		isEditedPostEmpty,
	} ) => {
		const [ warningModalVisible, setWarningModalVisible ] = useState( false );
		const { layouts, isFetchingLayouts } = useLayoutsState();

		const [ usedLayout, setUsedLayout ] = useState( {} );

		useEffect(() => {
			setUsedLayout( find( layouts, { ID: layoutId } ) || {} );
		}, [ layouts.length ]);

		const blockPreview = useMemo(() => {
			return usedLayout.post_content ? parse( usedLayout.post_content ) : null;
		}, [ usedLayout ]);

		const clearPost = () => {
			const clientIds = getBlocks().map( ( { clientId } ) => clientId );
			if ( clientIds && clientIds.length ) {
				replaceBlocks( clientIds, [] );
			}
		};

		const [ isSavingLayout, setIsSavingLayout ] = useState( false );
		const [ isManageModalVisible, setIsManageModalVisible ] = useState( null );
		const [ newLayoutName, setNewLayoutName ] = useState( postTitle );

		const handleLayoutUpdate = updatedLayout => {
			setIsSavingLayout( false );
			// Set this new layout as the newsletter's layout
			saveLayoutIdMeta( updatedLayout.id );

			// Update the layout preview
			// The shape of this data is different than the API response for CPT
			setUsedLayout( {
				...updatedLayout,
				post_content: updatedLayout.content.raw,
				post_title: updatedLayout.title.raw,
				post_type: LAYOUT_CPT_SLUG,
			} );
		};

		const handleSaveAsLayout = () => {
			setIsSavingLayout( true );
			const updatePayload = {
				title: newLayoutName,
				content: serialize( getBlocks() ),
			};
			saveLayout( updatePayload ).then( newLayout => {
				setIsManageModalVisible( false );

				handleLayoutUpdate( newLayout );
			} );
		};

		const handeLayoutUpdate = () => {
			setIsSavingLayout( true );
			const updatePayload = {
				content: serialize( getBlocks() ),
				id: usedLayout.ID,
			};
			saveLayout( updatePayload ).then( handleLayoutUpdate );
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
								<BlockPreview
									blocks={ setPreventDeduplicationForPostsInserter( blockPreview ) }
									viewportWidth={ 600 }
								/>
							</div>
							<div className="newspack-newsletters-layouts__item-label">
								{ usedLayout.post_title }
							</div>
						</div>
					</div>
				) }
				<Button isSecondary isDestructive onClick={ () => setWarningModalVisible( true ) }>
					{ __( 'Reset newsletter layout', 'newspack-newsletters' ) }
				</Button>
				<br />
				<br />
				<div className="newspack-newsletters-tabs">
					{ isUsingCustomLayout && (
						<Fragment>
							<Button isPrimary disabled={ isSavingLayout } onClick={ handeLayoutUpdate }>
								{ __( 'Update layout', 'newspack-newsletters' ) }
							</Button>
						</Fragment>
					) }
					<Button
						isPrimary
						disabled={ isEditedPostEmpty || isSavingLayout }
						onClick={ () => setIsManageModalVisible( true ) }
					>
						{ __( 'Create a layout', 'newspack-newsletters' ) }
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
								clearPost();
								saveLayoutIdMeta( -1 );
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

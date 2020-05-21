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
import { Fragment, useState } from '@wordpress/element';
import { Button, Modal, TextControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { useLayouts } from '../../utils/hooks';
import { LAYOUT_CPT_SLUG } from '../../utils/consts';
import { isUserDefinedLayout } from '../../utils';
import './style.scss';
import { setPreventDeduplicationForPostsInserter } from '../../editor/blocks/posts-inserter/utils';

export default compose( [
	withDispatch( dispatch => {
		const { replaceBlocks } = dispatch( 'core/block-editor' );
		const { editPost } = dispatch( 'core/editor' );
		const { saveEntityRecord } = dispatch( 'core' );
		return {
			replaceBlocks,
			setLayoutIdMeta: id => editPost( { meta: { layout_id: id } } ),
			saveLayout: payload =>
				saveEntityRecord( 'postType', LAYOUT_CPT_SLUG, {
					status: 'publish',
					...payload,
				} ),
		};
	} ),
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const { getBlocks } = select( 'core/block-editor' );
		const meta = getEditedPostAttribute( 'meta' );
		const { layout_id: layoutId } = meta;
		return {
			layoutId,
			postTitle: getEditedPostAttribute( 'title' ),
			getBlocks,
		};
	} ),
] )( ( { setLayoutIdMeta, layoutId, replaceBlocks, saveLayout, getBlocks, postTitle } ) => {
	const [ warningModalVisible, setWarningModalVisible ] = useState( false );
	const { layouts } = useLayouts();

	const usedLayout = find( layouts, { ID: layoutId } ) || {};
	const blockPreview = usedLayout.post_content ? parse( usedLayout.post_content ) : null;

	const clearPost = () => {
		const clientIds = getBlocks().map( ( { clientId } ) => clientId );
		if ( clientIds && clientIds.length ) {
			replaceBlocks( clientIds, [] );
		}
	};

	const [ isSavingLayout, setIsSavingLayout ] = useState( false );
	const [ manageModalState, setManageModalState ] = useState( null );
	const [ newLayoutName, setNewLayoutName ] = useState( postTitle );
	const handleSaveAsLayout = () => {
		setIsSavingLayout( true );
		const updatePayload = {
			title: newLayoutName,
			content: serialize( getBlocks() ),
		};
		if ( manageModalState.isUpdating ) {
			updatePayload.id = usedLayout.ID;
		}
		saveLayout( updatePayload ).then( () => {
			setIsSavingLayout( false );
			setManageModalState( false );
		} );
	};

	const isUsingCustomLayout = isUserDefinedLayout( usedLayout );

	return (
		<Fragment>
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
						<Button
							isPrimary
							disabled={ isSavingLayout }
							onClick={ () => {
								setNewLayoutName( usedLayout.post_title );
								setManageModalState( {
									title: __( 'Update layout', 'newspack-newsletters' ),
									saveButtonText: __( 'Update', 'newspack-newsletters' ),
									isUpdating: true,
								} );
							} }
						>
							{ __( 'Update layout', 'newspack-newsletters' ) }
						</Button>
					</Fragment>
				) }
				<Button
					isPrimary
					disabled={ isSavingLayout }
					onClick={ () => {
						setNewLayoutName( postTitle );
						setManageModalState( {
							title: __( 'Save newsletter as a layout', 'newspack-newsletters' ),
							saveButtonText: __( 'Save', 'newspack-newsletters' ),
						} );
					} }
				>
					{ __( 'Create a layout', 'newspack-newsletters' ) }
				</Button>
			</div>

			{ manageModalState && (
				<Modal
					className="newspack-newsletters__modal"
					title={ manageModalState.title }
					onRequestClose={ () => setManageModalState( null ) }
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
						{ manageModalState.saveButtonText }
					</Button>
					<Button isSecondary onClick={ () => setManageModalState( null ) }>
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
							setLayoutIdMeta( -1 );
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
} );

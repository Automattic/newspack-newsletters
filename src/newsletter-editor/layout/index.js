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
import { BLANK_LAYOUT_ID, LAYOUT_CPT_SLUG } from '../../utils/consts';
import './style.scss';
import { setPreventDeduplicationForPostsInserter } from '../../editor/blocks/posts-inserter/utils';

const getEditLink = postId => `post.php?post=${ postId }&action=edit`;

export default compose( [
	withDispatch( dispatch => {
		const { replaceBlocks } = dispatch( 'core/block-editor' );
		const { editPost } = dispatch( 'core/editor' );
		const { saveEntityRecord } = dispatch( 'core' );
		return {
			replaceBlocks,
			setLayoutIdMeta: id => editPost( { meta: { layout_id: id } } ),
			addLayout: ( { content, title } ) =>
				saveEntityRecord( 'postType', LAYOUT_CPT_SLUG, {
					status: 'publish',
					title,
					content,
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
] )( ( { setLayoutIdMeta, layoutId, replaceBlocks, addLayout, getBlocks, postTitle } ) => {
	const [ warningModalVisible, setWarningModalVisible ] = useState( false );
	const layouts = useLayouts();

	const { post_content: content, post_title: title } = find( layouts, { ID: layoutId } ) || {};
	const blockPreview = content ? parse( content ) : null;

	const clearPost = () => {
		const clientIds = getBlocks().map( ( { clientId } ) => clientId );
		if ( clientIds && clientIds.length ) {
			replaceBlocks( clientIds, [] );
		}
	};

	const [ isSavingLayout, setIsSavingLayout ] = useState( false );
	const [ isSaveModalVisible, setIsSaveModalVisible ] = useState( false );
	const [ newLayoutName, setNewLayoutName ] = useState( postTitle );
	const handleSaveAsLayout = () => {
		setIsSavingLayout( true );
		addLayout( { title: newLayoutName, content: serialize( getBlocks() ) } ).then( () => {
			setIsSavingLayout( false );
			setIsSaveModalVisible( false );
		} );
	};

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
						<div className="newspack-newsletters-layouts__item-label">{ title }</div>
					</div>
				</div>
			) }
			<Button isPrimary onClick={ () => setWarningModalVisible( true ) }>
				{ __( 'Change layout', 'newspack-newsletters' ) }
			</Button>
			<br />
			<br />
			{ layoutId !== BLANK_LAYOUT_ID && (
				<Fragment>
					<Button isLink href={ getEditLink( layoutId ) }>
						{ __( 'Edit this layout', 'newspack-newsletters' ) }
					</Button>
					<br />
					<br />
				</Fragment>
			) }
			<Button isPrimary disabled={ isSavingLayout } onClick={ () => setIsSaveModalVisible( true ) }>
				{ __( 'Save Newsletter as a layout', 'newspack-newsletters' ) }
			</Button>
			{ isSaveModalVisible && (
				<Modal
					className="newspack-newsletters__modal"
					title={ __( 'Save Newsletter as a layout', 'newspack-newsletters' ) }
					onRequestClose={ () => setIsSaveModalVisible( false ) }
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
					<Button isSecondary onClick={ () => setIsSaveModalVisible( false ) }>
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
						{ __( 'Change Layout', 'newspack-newsletters' ) }
					</Button>
					<Button isSecondary onClick={ () => setWarningModalVisible( false ) }>
						{ __( 'Cancel', 'newspack-newsletters' ) }
					</Button>
				</Modal>
			) }
		</Fragment>
	);
} );

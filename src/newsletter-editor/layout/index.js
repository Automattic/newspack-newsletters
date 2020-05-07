/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import { parse } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { BlockPreview } from '@wordpress/block-editor';
import { withDispatch, withSelect } from '@wordpress/data';
import { Fragment, useState } from '@wordpress/element';
import { Button, Modal } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './style.scss';
import { setPreventDeduplicationForPostsInserter } from '../../editor/blocks/posts-inserter/utils';

export default compose( [
	withDispatch( dispatch => {
		const { replaceBlocks } = dispatch( 'core/block-editor' );
		const { editPost } = dispatch( 'core/editor' );
		return {
			replaceBlocks,
			setTemplateIDMeta: templateId => editPost( { meta: { template_id: templateId } } ),
		};
	} ),
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const { getBlocks } = select( 'core/block-editor' );
		const meta = getEditedPostAttribute( 'meta' );
		const { template_id: templateId } = meta;
		return { templateId, getBlocks };
	} ),
] )( ( { getBlocks, setTemplateIDMeta, templateId, templates, replaceBlocks } ) => {
	const [ warningModalVisible, setWarningModalVisible ] = useState( false );
	const currentTemplate = templates && templates[ templateId ] ? templates[ templateId ] : {};
	const { content, title } = currentTemplate;
	const blockPreview = content ? parse( content ) : null;

	const clearPost = () => {
		const clientIds = getBlocks().map( ( { clientId } ) => clientId );
		if ( clientIds && clientIds.length ) {
			replaceBlocks( clientIds, [] );
		}
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
				{ __( 'Change Layout', 'newspack-newsletters' ) }
			</Button>
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
							setTemplateIDMeta( -1 );
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

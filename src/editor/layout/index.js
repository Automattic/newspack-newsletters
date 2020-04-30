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

export default compose( [
	withDispatch( dispatch => {
		return {
			setTemplateIDMeta: templateId =>
				dispatch( 'core/editor' ).editPost( { meta: { template_id: templateId } } ),
		};
	} ),
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		const { template_id: templateId } = meta;
		return { templateId };
	} ),
] )( ( { setTemplateIDMeta, templateId, templates } ) => {
	const [ warningModalVisible, setWarningModalVisible ] = useState( false );
	const currentTemplate = templates && templates[ templateId ] ? templates[ templateId ] : {};
	const { content, title } = currentTemplate;
	const blockPreview = content ? parse( content ) : null;
	return (
		<Fragment>
			{ blockPreview !== null && (
				<div className="newspack-newsletters-layouts">
					<div className="newspack-newsletters-layouts__item">
						<div className="newspack-newsletters-layouts__item-preview">
							<BlockPreview blocks={ blockPreview } viewportWidth={ 560 } />
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
					className="newspack-newsletters-layouts__modal"
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

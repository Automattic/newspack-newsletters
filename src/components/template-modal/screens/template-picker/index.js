/**
 * External dependencies
 */
import classnames from 'classnames';
import { find } from 'lodash';

/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { Fragment, useMemo, useState } from '@wordpress/element';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { BlockPreview } from '@wordpress/block-editor';
import { ENTER, SPACE } from '@wordpress/keycodes';

/**
 * Internal dependencies
 */
import { setPreventDeduplicationForPostsInserter } from '../../../../editor/blocks/posts-inserter/utils';
import { BLANK_TEMPLATE_ID } from '../../../../utils/consts';
import { useLayouts } from '../../../../utils/hooks';

const TemplatePicker = ( {
	getBlocks,
	insertBlocks,
	replaceBlocks,
	savePost,
	setTemplateIdMeta,
} ) => {
	const templates = useLayouts();

	const insertTemplate = templateId => {
		const { post_content: content } = find( templates, { ID: templateId } ) || {};
		const blocksToInsert = content ? parse( content ) : [];
		const existingBlocksIds = getBlocks().map( ( { clientId } ) => clientId );
		if ( existingBlocksIds.length ) {
			replaceBlocks( existingBlocksIds, blocksToInsert );
		} else {
			insertBlocks( blocksToInsert );
		}
		setTemplateIdMeta( templateId );
		setTimeout( savePost, 1 );
	};

	const [ selectedTemplateId, setSelectedTemplateId ] = useState( null );
	const templateBlocks = useMemo(() => {
		const template = selectedTemplateId && find( templates, { ID: selectedTemplateId } );
		return template ? parse( template.post_content ) : null;
	}, [ selectedTemplateId, templates.length ]);

	return (
		<Fragment>
			<div className="newspack-newsletters-modal__content">
				<div className="newspack-newsletters-modal__layouts">
					<div className="newspack-newsletters-layouts">
						{ templates.map( ( { ID, post_title: title, post_content: content } ) =>
							'' === content ? null : (
								<div
									key={ ID }
									className={ classnames( 'newspack-newsletters-layouts__item', {
										'is-active': selectedTemplateId === ID,
									} ) }
									onClick={ () => setSelectedTemplateId( ID ) }
									onKeyDown={ event => {
										if ( ENTER === event.keyCode || SPACE === event.keyCode ) {
											event.preventDefault();
											setSelectedTemplateId( ID );
										}
									} }
									role="button"
									tabIndex="0"
									aria-label={ title }
								>
									<div className="newspack-newsletters-layouts__item-preview">
										<BlockPreview
											blocks={ setPreventDeduplicationForPostsInserter( parse( content ) ) }
											viewportWidth={ 600 }
										/>
									</div>
									<div className="newspack-newsletters-layouts__item-label">{ title }</div>
								</div>
							)
						) }
					</div>
				</div>

				<div className="newspack-newsletters-modal__preview">
					{ templateBlocks && templateBlocks.length > 0 ? (
						<BlockPreview blocks={ templateBlocks } viewportWidth={ 600 } />
					) : (
						<p>{ __( 'Select a layout to preview.', 'newspack-newsletters' ) }</p>
					) }
				</div>
			</div>
			<div className="newspack-newsletters-modal__action-buttons">
				<Button isSecondary onClick={ () => insertTemplate( BLANK_TEMPLATE_ID ) }>
					{ __( 'Start From Scratch', 'newspack-newsletters' ) }
				</Button>
				<span className="separator">{ __( 'or', 'newspack-newsletters' ) }</span>
				<Button
					isPrimary
					disabled={ selectedTemplateId === BLANK_TEMPLATE_ID }
					onClick={ () => insertTemplate( selectedTemplateId ) }
				>
					{ __( 'Use Selected Layout', 'newspack-newsletters' ) }
				</Button>
			</div>
		</Fragment>
	);
};

export default compose( [
	withSelect( select => {
		const { getBlocks } = select( 'core/block-editor' );
		return {
			getBlocks,
		};
	} ),
	withDispatch( dispatch => {
		const { savePost, editPost } = dispatch( 'core/editor' );
		const { insertBlocks, replaceBlocks } = dispatch( 'core/block-editor' );
		return {
			savePost,
			insertBlocks,
			replaceBlocks,
			setTemplateIdMeta: templateId => editPost( { meta: { template_id: templateId } } ),
		};
	} ),
] )( TemplatePicker );

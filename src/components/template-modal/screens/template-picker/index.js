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
import { templatesSelector } from '../../../../store/selectors';
import { BLANK_TEMPLATE_ID } from '../../../../consts';

const TemplatePicker = ( {
	getBlocks,
	insertBlocks,
	replaceBlocks,
	savePost,
	setTemplateIdMeta,
	templates,
} ) => {
	const insertTemplate = templateId => {
		const { content } = find( templates, { id: templateId } ) || {};
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
		const template = selectedTemplateId && find( templates, { id: selectedTemplateId } );
		return template ? parse( template.content ) : null;
	}, [ selectedTemplateId, templates.length ]);

	return (
		<Fragment>
			<div className="newspack-newsletters-modal__content">
				<div className="newspack-newsletters-modal__layouts">
					<div className="newspack-newsletters-layouts">
						{ templates.map( ( { id, title, content } ) =>
							'' === content ? null : (
								<div
									key={ id }
									className={ classnames( 'newspack-newsletters-layouts__item', {
										'is-active': selectedTemplateId === id,
									} ) }
									onClick={ () => setSelectedTemplateId( id ) }
									onKeyDown={ event => {
										if ( ENTER === event.keyCode || SPACE === event.keyCode ) {
											event.preventDefault();
											setSelectedTemplateId( id );
										}
									} }
									role="button"
									tabIndex="0"
									aria-label={ title }
								>
									<div className="newspack-newsletters-layouts__item-preview">
										<BlockPreview
											blocks={ setPreventDeduplicationForPostsInserter( parse( content ) ) }
											viewportWidth={ 560 }
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
						<BlockPreview blocks={ templateBlocks } viewportWidth={ 560 } />
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
			templates: templatesSelector( select ),
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

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
import { BLANK_LAYOUT_ID } from '../../../../utils/consts';
import { useLayouts } from '../../../../utils/hooks';

const LayoutPicker = ( { getBlocks, insertBlocks, replaceBlocks, savePost, setLayoutIdMeta } ) => {
	const layouts = useLayouts();

	const insertLayout = layoutId => {
		const { post_content: content } = find( layouts, { ID: layoutId } ) || {};
		const blocksToInsert = content ? parse( content ) : [];
		const existingBlocksIds = getBlocks().map( ( { clientId } ) => clientId );
		if ( existingBlocksIds.length ) {
			replaceBlocks( existingBlocksIds, blocksToInsert );
		} else {
			insertBlocks( blocksToInsert );
		}
		setLayoutIdMeta( layoutId );
		setTimeout( savePost, 1 );
	};

	const [ selectedLayoutId, setSelectedLayoutId ] = useState( null );
	const layoutBlocks = useMemo(() => {
		const layout = selectedLayoutId && find( layouts, { ID: selectedLayoutId } );
		return layout ? parse( layout.post_content ) : null;
	}, [ selectedLayoutId, layouts.length ]);

	return (
		<Fragment>
			<div className="newspack-newsletters-modal__content">
				<div className="newspack-newsletters-modal__layouts">
					<div className="newspack-newsletters-layouts">
						{ layouts.map( ( { ID, post_title: title, post_content: content } ) =>
							'' === content ? null : (
								<div
									key={ ID }
									className={ classnames( 'newspack-newsletters-layouts__item', {
										'is-active': selectedLayoutId === ID,
									} ) }
									onClick={ () => setSelectedLayoutId( ID ) }
									onKeyDown={ event => {
										if ( ENTER === event.keyCode || SPACE === event.keyCode ) {
											event.preventDefault();
											setSelectedLayoutId( ID );
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
					{ layoutBlocks && layoutBlocks.length > 0 ? (
						<BlockPreview blocks={ layoutBlocks } viewportWidth={ 600 } />
					) : (
						<p>{ __( 'Select a layout to preview.', 'newspack-newsletters' ) }</p>
					) }
				</div>
			</div>
			<div className="newspack-newsletters-modal__action-buttons">
				<Button isSecondary onClick={ () => insertLayout( BLANK_LAYOUT_ID ) }>
					{ __( 'Start From Scratch', 'newspack-newsletters' ) }
				</Button>
				<span className="separator">{ __( 'or', 'newspack-newsletters' ) }</span>
				<Button
					isPrimary
					disabled={ selectedLayoutId === BLANK_LAYOUT_ID }
					onClick={ () => insertLayout( selectedLayoutId ) }
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
			setLayoutIdMeta: id => editPost( { meta: { template_id: id } } ),
		};
	} ),
] )( LayoutPicker );

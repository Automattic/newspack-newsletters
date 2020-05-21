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
import { Button, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { BlockPreview } from '@wordpress/block-editor';
import { ENTER, SPACE } from '@wordpress/keycodes';

/**
 * Internal dependencies
 */
import { setPreventDeduplicationForPostsInserter } from '../../../../editor/blocks/posts-inserter/utils';
import { BLANK_LAYOUT_ID } from '../../../../utils/consts';
import { isUserDefinedLayout } from '../../../../utils';
import { useLayouts } from '../../../../utils/hooks';

const SingleLayoutPreview = ( {
	deleteHandler,
	selectedLayoutId,
	setSelectedLayoutId,
	ID,
	post_title: title,
	post_content: content,
	...post
} ) => {
	const isDeletable = isUserDefinedLayout( post );

	const handleDelete = () => {
		// eslint-disable-next-line no-alert
		if ( confirm( __( 'Are you sure you want to delete this layout?', 'newspack-newsletters' ) ) ) {
			deleteHandler( ID );
		}
	};

	return '' === content ? null : (
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
			{ isDeletable && (
				<Button isDestructive onClick={ handleDelete }>
					{ __( 'Delete', 'newspack-newsletters' ) }
				</Button>
			) }
		</div>
	);
};

const LAYOUTS_TABS = [
	{
		title: __( 'Default layouts', 'newspack-newsletters' ),
		filter: layout => layout.post_author === undefined,
	},
	{
		title: __( 'My layouts', 'newspack-newsletters' ),
		filter: isUserDefinedLayout,
	},
];

const LayoutPicker = ( { getBlocks, insertBlocks, replaceBlocks, savePost, setLayoutIdMeta } ) => {
	const { layouts, isFetchingLayouts, deleteLayoutPost } = useLayouts();

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

	const renderPreview = () =>
		layoutBlocks && layoutBlocks.length > 0 ? (
			<BlockPreview blocks={ layoutBlocks } viewportWidth={ 600 } />
		) : (
			<p>{ __( 'Select a layout to preview.', 'newspack-newsletters' ) }</p>
		);

	const [ activeTabIndex, setActiveTabIndex ] = useState( 0 );
	const activeTab = LAYOUTS_TABS[ activeTabIndex ];
	const displayedLayouts = layouts.filter( activeTab.filter );

	return (
		<Fragment>
			<div className="newspack-newsletters-modal__content">
				<div className="newspack-newsletters-tabs">
					{ LAYOUTS_TABS.map( ( { title }, i ) => (
						<Button
							key={ i }
							isSecondary={ i !== activeTabIndex }
							isPrimary={ i === activeTabIndex }
							onClick={ () => setActiveTabIndex( i ) }
						>
							{ title }
						</Button>
					) ) }
				</div>
				<div
					className={ classnames( 'newspack-newsletters-modal__layouts', {
						'newspack-newsletters-modal__layouts--loading': isFetchingLayouts,
					} ) }
				>
					{ isFetchingLayouts ? (
						<Spinner />
					) : (
						<div
							className={ classnames( {
								'newspack-newsletters-layouts': displayedLayouts.length > 0,
							} ) }
						>
							{ displayedLayouts.length ? (
								displayedLayouts.map( layout => (
									<SingleLayoutPreview
										key={ layout.ID }
										selectedLayoutId={ selectedLayoutId }
										setSelectedLayoutId={ setSelectedLayoutId }
										deleteHandler={ deleteLayoutPost }
										{ ...layout }
									/>
								) )
							) : (
								<span>
									{ __(
										'Turn any newsletter to a layout via the "Layout" sidebar menu in the editor.',
										'newspack-newsletters'
									) }
								</span>
							) }
						</div>
					) }
				</div>

				<div className="newspack-newsletters-modal__preview">
					{ ! isFetchingLayouts && renderPreview() }
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
			setLayoutIdMeta: id => editPost( { meta: { layout_id: id } } ),
		};
	} ),
] )( LayoutPicker );

/**
 * External dependencies
 */
import classnames from 'classnames';
import { find } from 'lodash';

/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { useState, useEffect } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { Button, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { BLANK_LAYOUT_ID } from '../../../../utils/consts';
import { isUserDefinedLayout } from '../../../../utils';
import { useLayoutsState } from '../../../../utils/hooks';
import SingleLayoutPreview from './SingleLayoutPreview';

const LAYOUTS_TABS = [
	{
		title: __( 'Prebuilt Layouts', 'newspack-newsletters' ),
		filter: layout => layout.post_author === undefined,
	},
	{
		title: __( 'Saved Layouts', 'newspack-newsletters' ),
		filter: isUserDefinedLayout,
		isEditable: true,
	},
];

export default function LayoutPicker() {
	const { savePost, editPost, resetEditorBlocks } = useDispatch( 'core/editor' );
	const { layouts, isFetchingLayouts, deleteLayoutPost } = useLayoutsState();

	const insertLayout = layoutId => {
		const { post_content, meta = {} } = find( layouts, { ID: layoutId } ) || {};
		if ( meta.campaign_defaults && 'string' === typeof meta.campaign_defaults ) {
			meta.stringifiedCampaignDefaults = meta.campaign_defaults;
		}
		editPost( { meta: { template_id: layoutId, ...meta } } );
		resetEditorBlocks( post_content ? parse( post_content ) : [] );
		savePost();
	};

	const [ selectedLayoutId, setSelectedLayoutId ] = useState( null );
	const [ activeTabIndex, setActiveTabIndex ] = useState( 0 );
	const activeTab = LAYOUTS_TABS[ activeTabIndex ];
	const displayedLayouts = layouts.filter( activeTab.filter );

	// Switch tab to user layouts if there are any.
	useEffect( () => {
		if ( layouts.filter( isUserDefinedLayout ).length ) {
			setActiveTabIndex( 1 );
		}
	}, [ layouts.length ] );

	return (
		<>
			<div className="newspack-newsletters-modal__content">
				<div className="newspack-newsletters-modal__content__sidebar">
					<div className="newspack-newsletters-modal__content__sidebar-wrapper">
						<p>
							{ __( 'Choose a layout or start with a blank newsletter.', 'newspack-newsletters' ) }
						</p>
						<div className="newspack-newsletters-modal__content__layout-buttons">
							{ LAYOUTS_TABS.map( ( { title }, i ) => (
								<Button
									key={ i }
									disabled={ isFetchingLayouts }
									variant={ ! isFetchingLayouts && i === activeTabIndex ? 'primary' : 'tertiary' }
									onClick={ () => setActiveTabIndex( i ) }
								>
									{ title }
								</Button>
							) ) }
						</div>
					</div>
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
							className={
								displayedLayouts.length > 0
									? 'newspack-newsletters-layouts'
									: 'newspack-newsletters-layouts--empty'
							}
						>
							{ displayedLayouts.length ? (
								displayedLayouts.map( layout => (
									<SingleLayoutPreview
										key={ layout.ID }
										selectedLayoutId={ selectedLayoutId }
										setSelectedLayoutId={ setSelectedLayoutId }
										deleteHandler={ deleteLayoutPost }
										isEditable={ activeTab.isEditable }
										{ ...layout }
									/>
								) )
							) : (
								<>
									<h3 className="newspack-newsletters-layouts--empty">
										{ __( 'You don’t have any saved layouts yet.', 'newspack-newsletters' ) }
									</h3>
									<p>
										{ __(
											'Turn any newsletter to a layout via the "Layout" sidebar menu in the editor.',
											'newspack-newsletters'
										) }
									</p>
								</>
							) }
						</div>
					) }
				</div>
			</div>
			<div className="newspack-newsletters-modal__action-buttons">
				<Button isSecondary onClick={ () => insertLayout( BLANK_LAYOUT_ID ) }>
					{ __( 'Blank Newsletter', 'newspack-newsletters' ) }
				</Button>
				<Button
					isPrimary
					disabled={ isFetchingLayouts || ! selectedLayoutId }
					onClick={ () => insertLayout( selectedLayoutId ) }
				>
					{ __( 'Use Selected Layout', 'newspack-newsletters' ) }
				</Button>
			</div>
		</>
	);
}

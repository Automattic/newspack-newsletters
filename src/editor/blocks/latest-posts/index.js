/**
 * External dependencies
 */
import { isUndefined, pickBy, get } from 'lodash';

/**
 * WordPress dependencies
 */
import { registerBlockType, createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { RangeControl, Button, ToggleControl, PanelBody } from '@wordpress/components';
import { InnerBlocks, BlockPreview, InspectorControls } from '@wordpress/block-editor';
import { Fragment, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import './style.scss';
import icon from './icon';
import { getBlocksTemplate } from './utils';
import QueryControlsSettings from './query-controls';

const createBlockWithInnerBlocks = ( [ name, blockAttributes, innerBlocks = [] ] ) =>
	createBlock( name, blockAttributes, innerBlocks.map( createBlockWithInnerBlocks ) );

const LatestPostsBlock = ( { setAttributes, attributes, latestPosts, replaceBlocks } ) => {
	const templateBlocks = getBlocksTemplate( latestPosts, attributes ).map(
		createBlockWithInnerBlocks
	);

	useEffect(() => {
		if ( attributes.areBlocksInserted ) {
			replaceBlocks( templateBlocks );
		}
	}, [ attributes.areBlocksInserted ]);

	return attributes.areBlocksInserted ? null : (
		<Fragment>
			<InspectorControls>
				<PanelBody title={ __( 'Post content settings', 'newspack-newsletters' ) }>
					<ToggleControl
						label={ __( 'Display post excerpt', 'newspack-newsletters' ) }
						checked={ attributes.displayPostExcerpt }
						onChange={ value => setAttributes( { displayPostExcerpt: value } ) }
					/>
					{ attributes.displayPostExcerpt && (
						<RangeControl
							label={ __( 'Max number of words in excerpt', 'newspack-newsletters' ) }
							value={ attributes.excerptLength }
							onChange={ value => setAttributes( { excerptLength: value } ) }
							min={ 10 }
							max={ 100 }
						/>
					) }
					<ToggleControl
						label={ __( 'Display date', 'newspack-newsletters' ) }
						checked={ attributes.displayPostDate }
						onChange={ value => setAttributes( { displayPostDate: value } ) }
					/>
					<ToggleControl
						label={ __( 'Display featured image', 'newspack-newsletters' ) }
						checked={ attributes.displayFeaturedImage }
						onChange={ value => setAttributes( { displayFeaturedImage: value } ) }
					/>
				</PanelBody>
				<PanelBody title={ __( 'Sorting and filtering', 'newspack-newsletters' ) }>
					<QueryControlsSettings attributes={ attributes } setAttributes={ setAttributes } />
				</PanelBody>
			</InspectorControls>
			<div className="newspack-latest-posts">
				<Button isPrimary onClick={ () => setAttributes( { areBlocksInserted: true } ) }>
					{ __( 'Insert', 'newspack-newsletters' ) }
				</Button>
				<div className="newspack-latest-posts__preview">
					<BlockPreview blocks={ templateBlocks } />
				</div>
			</div>
		</Fragment>
	);
};

const LatestPostsBlockWithSelect = compose( [
	withSelect( ( select, props ) => {
		const { postsToShow, order, orderBy, categories } = props.attributes;
		const { getEntityRecords, getMedia } = select( 'core' );
		const { getSelectedBlock } = select( 'core/block-editor' );
		const catIds = categories && categories.length > 0 ? categories.map( cat => cat.id ) : [];
		const latestPostsQuery = pickBy(
			{
				categories: catIds,
				order,
				orderby: orderBy,
				per_page: postsToShow,
			},
			value => ! isUndefined( value )
		);

		const posts = getEntityRecords( 'postType', 'post', latestPostsQuery ) || [];

		return {
			selectedBlock: getSelectedBlock(),
			latestPosts: posts.map( post => {
				if ( post.featured_media ) {
					const image = getMedia( post.featured_media );
					let url = get( image, [ 'media_details', 'sizes', 'medium', 'source_url' ], null );
					if ( ! url ) {
						url = get( image, 'source_url', null );
					}
					return { ...post, featuredImageSourceUrl: url };
				}
				return post;
			} ),
		};
	} ),
	withDispatch( ( dispatch, props ) => {
		const { replaceBlocks } = dispatch( 'core/block-editor' );
		return {
			replaceBlocks: blocks => {
				replaceBlocks( props.selectedBlock.clientId, blocks );
			},
		};
	} ),
] )( LatestPostsBlock );

export default () => {
	registerBlockType( 'newspack-newsletters/latest-posts', {
		title: 'Latest Posts',
		category: 'widgets',
		icon,
		edit: LatestPostsBlockWithSelect,
		attributes: {
			areBlocksInserted: {
				type: 'boolean',
				default: false,
			},
			postsToShow: {
				type: 'number',
				default: 3,
			},
			displayPostExcerpt: {
				type: 'boolean',
				default: false,
			},
			excerptLength: {
				type: 'number',
				default: 42,
			},
			displayPostDate: {
				type: 'boolean',
				default: true,
			},
			displayFeaturedImage: {
				type: 'boolean',
				default: true,
			},
		},
		save: () => <InnerBlocks.Content />,
	} );
};

/**
 * External dependencies
 */
import { values, isUndefined, pickBy, get, omit } from 'lodash';

/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { RangeControl, Button, ToggleControl, PanelBody, Toolbar } from '@wordpress/components';
import {
	InnerBlocks,
	BlockPreview,
	InspectorControls,
	BlockControls,
} from '@wordpress/block-editor';
import { Fragment, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import './style.scss';
import Icon from './icon';
import { getTemplateBlocks, convertBlockSerializationFormat } from './utils';
import QueryControlsSettings from './query-controls';

const PostsInserterBlock = ( { setAttributes, attributes, postList, replaceBlocks } ) => {
	const templateBlocks = getTemplateBlocks( postList, attributes );

	useEffect( () => {
		setAttributes( { innerBlocksToInsert: templateBlocks.map( convertBlockSerializationFormat ) } );
	}, values( omit( attributes, 'innerBlocksToInsert' ) ) );

	useEffect(() => {
		if ( attributes.areBlocksInserted ) {
			replaceBlocks( templateBlocks );
		}
	}, [ attributes.areBlocksInserted ]);

	const blockControlsImages = [
		{
			icon: 'align-none',
			title: __( 'Show image on top', 'newspack-blocks' ),
			isActive: attributes.featuredImageAlignment === 'top',
			onClick: () => setAttributes( { featuredImageAlignment: 'top' } ),
		},
		{
			icon: 'align-pull-left',
			title: __( 'Show image on left', 'newspack-blocks' ),
			isActive: attributes.featuredImageAlignment === 'left',
			onClick: () => setAttributes( { featuredImageAlignment: 'left' } ),
		},
		{
			icon: 'align-pull-right',
			title: __( 'Show image on right', 'newspack-blocks' ),
			isActive: attributes.featuredImageAlignment === 'right',
			onClick: () => setAttributes( { featuredImageAlignment: 'right' } ),
		},
	];

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

			<BlockControls>
				{ attributes.displayFeaturedImage && <Toolbar controls={ blockControlsImages } /> }
			</BlockControls>

			<div className="newspack-posts-inserter">
				<div className="newspack-posts-inserter__header">
					{ Icon }
					<span>{ __( 'Posts Inserter', 'newspack-newsletters' ) }</span>
				</div>
				<div className="newspack-posts-inserter__preview">
					<BlockPreview blocks={ templateBlocks } viewportWidth={ 566 } />
				</div>
				<Button isPrimary onClick={ () => setAttributes( { areBlocksInserted: true } ) }>
					{ __( 'Insert posts', 'newspack-newsletters' ) }
				</Button>
			</div>
		</Fragment>
	);
};

const PostsInserterBlockWithSelect = compose( [
	withSelect( ( select, props ) => {
		const { postsToShow, order, orderBy, categories } = props.attributes;
		const { getEntityRecords, getMedia } = select( 'core' );
		const { getSelectedBlock } = select( 'core/block-editor' );
		const catIds = categories && categories.length > 0 ? categories.map( cat => cat.id ) : [];
		const postListQuery = pickBy(
			{
				categories: catIds,
				order,
				orderby: orderBy,
				per_page: postsToShow,
			},
			value => ! isUndefined( value )
		);

		const posts = getEntityRecords( 'postType', 'post', postListQuery ) || [];

		return {
			selectedBlock: getSelectedBlock(),
			postList: posts.map( post => {
				if ( post.featured_media ) {
					const image = getMedia( post.featured_media );
					const fallbackImageURL = get( image, 'source_url', null );
					const featuredImageMediumURL =
						get( image, [ 'media_details', 'sizes', 'medium', 'source_url' ], null ) ||
						fallbackImageURL;
					const featuredImageLargeURL =
						get( image, [ 'media_details', 'sizes', 'large', 'source_url' ], null ) ||
						fallbackImageURL;
					return { ...post, featuredImageMediumURL, featuredImageLargeURL };
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
] )( PostsInserterBlock );

export default () => {
	registerBlockType( 'newspack-newsletters/posts-inserter', {
		title: 'Posts Inserter',
		category: 'widgets',
		icon: Icon,
		edit: PostsInserterBlockWithSelect,
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
				default: true,
			},
			excerptLength: {
				type: 'number',
				default: 15,
			},
			displayPostDate: {
				type: 'boolean',
				default: false,
			},
			displayFeaturedImage: {
				type: 'boolean',
				default: true,
			},
			innerBlocksToInsert: {
				type: 'array',
				default: '',
			},
			featuredImageAlignment: {
				type: 'string',
				default: 'left',
			},
		},
		save: () => <InnerBlocks.Content />,
	} );
};

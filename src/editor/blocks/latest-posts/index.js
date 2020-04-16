/**
 * External dependencies
 */
import { isUndefined, pickBy, flatten } from 'lodash';

/**
 * WordPress dependencies
 */
import { registerBlockType, createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { RangeControl, Button, ToggleControl, PanelBody } from '@wordpress/components';
import { InnerBlocks, BlockPreview, InspectorControls } from '@wordpress/block-editor';
import { Fragment } from '@wordpress/element';

/**
 * Internal dependencies
 */
import './style.scss';
import icon from './icon';
import { getBlocksTemplate } from './utils';
import QueryControlsSettings from './query-controls';

const LatestPostsBlock = ( { setAttributes, attributes, latestPosts } ) => {
	const templateBlocks = flatten( getBlocksTemplate( latestPosts, attributes ) );
	return attributes.isReady ? (
		<InnerBlocks template={ templateBlocks } />
	) : (
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
				</PanelBody>
				<PanelBody title={ __( 'Sorting and filtering', 'newspack-newsletters' ) }>
					<QueryControlsSettings attributes={ attributes } setAttributes={ setAttributes } />
				</PanelBody>
			</InspectorControls>
			<div className="newspack-latest-posts">
				<Button isPrimary onClick={ () => setAttributes( { isReady: true } ) }>
					{ __( 'Insert', 'newspack-newsletters' ) }
				</Button>
				<div className="newspack-latest-posts__preview">
					<BlockPreview blocks={ templateBlocks.map( template => createBlock( ...template ) ) } />
				</div>
			</div>
		</Fragment>
	);
};

const LatestPostsBlockWithSelect = compose( [
	withSelect( ( select, props ) => {
		const { postsToShow, order, orderBy, categories } = props.attributes;
		const { getEntityRecords } = select( 'core' );
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

		return {
			latestPosts: getEntityRecords( 'postType', 'post', latestPostsQuery ) || [],
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
			isReady: {
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
				default: false,
			},
		},
		save: () => <InnerBlocks.Content />,
	} );
};

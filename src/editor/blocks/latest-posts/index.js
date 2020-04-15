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
import { RangeControl, Button, ToggleControl } from '@wordpress/components';
import { InnerBlocks, BlockPreview } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import './style.scss';
import icon from './icon';
import { getBlocksTemplate } from './utils';

const LatestPostsBlock = ( { setAttributes, attributes, latestPosts } ) => {
	const templateBlocks = flatten( getBlocksTemplate( latestPosts, attributes ) );
	return attributes.isReady ? (
		<InnerBlocks template={ templateBlocks } />
	) : (
		<div className="newspack-latest-posts">
			<RangeControl
				label={ __( 'Number of posts', 'newspack-newsletters' ) }
				value={ attributes.postsToShow }
				onChange={ value => setAttributes( { postsToShow: value } ) }
				min={ 1 }
				max={ 10 }
			/>

			<ToggleControl
				label={ __( 'Display post excerpt' ) }
				checked={ attributes.displayPostExcerpt }
				onChange={ value => setAttributes( { displayPostExcerpt: value } ) }
			/>
			{ attributes.displayPostExcerpt && (
				<RangeControl
					label={ __( 'Max number of words in excerpt' ) }
					value={ attributes.excerptLength }
					onChange={ value => setAttributes( { excerptLength: value } ) }
					min={ 10 }
					max={ 100 }
				/>
			) }

			<Button isPrimary onClick={ () => setAttributes( { isReady: true } ) }>
				{ __( 'Insert', 'newspack-newsletters' ) }
			</Button>
			<div className="newspack-latest-posts__preview">
				<BlockPreview blocks={ templateBlocks.map( template => createBlock( ...template ) ) } />
			</div>
		</div>
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
		},
		save: () => <InnerBlocks.Content />,
	} );
};

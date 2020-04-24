/**
 * External dependencies
 */
import { omit, isEqual } from 'lodash';
import memoizeOne from 'memoize-one';

/**
 * WordPress dependencies
 */
import { createBlock, getBlockContent } from '@wordpress/blocks';
import { dateI18n, __experimentalGetSettings } from '@wordpress/date';

const getHeadingBlockTemplate = post => [
	'core/heading',
	{ content: `<a href="${ post.link }">${ post.title.rendered }</a>`, level: 3 },
];

const getDateBlockTemplate = post => {
	const dateFormat = __experimentalGetSettings().formats.date;
	return [
		'core/paragraph',
		{
			content: dateI18n( dateFormat, post.date_gmt ),
			fontSize: 'normal',
			customTextColor: '#444444',
		},
	];
};

const getExcerptBlockTemplate = ( post, { excerptLength } ) => {
	let excerpt = post.content.rendered;
	const excerptElement = document.createElement( 'div' );
	excerptElement.innerHTML = excerpt;
	excerpt = excerptElement.textContent || excerptElement.innerText || '';

	const needsEllipsis =
		excerptLength < excerpt.trim().split( ' ' ).length && post.excerpt.raw === '';

	const postExcerpt = needsEllipsis
		? `${ excerpt.split( ' ', excerptLength ).join( ' ' ) } […]`
		: excerpt;
	return [ 'core/paragraph', { content: postExcerpt.trim() } ];
};

const createBlockTemplatesForSinglePost = (
	post,
	{
		displayPostDate,
		displayPostExcerpt,
		excerptLength,
		displayFeaturedImage,
		featuredImageAlignment,
	}
) => {
	const postContentBlocks = [ getHeadingBlockTemplate( post ) ];

	if ( displayPostDate && post.date_gmt ) {
		postContentBlocks.push( getDateBlockTemplate( post ) );
	}
	if ( displayPostExcerpt ) {
		postContentBlocks.push( getExcerptBlockTemplate( post, { excerptLength } ) );
	}

	if ( displayFeaturedImage ) {
		const getImageBlock = ( alignCenter = false ) => [
			'core/image',
			{
				url: alignCenter ? post.featuredImageLargeURL : post.featuredImageMediumURL,
				linkDestination: post.link,
				...( alignCenter ? { align: 'center' } : {} ),
			},
		];
		const imageColumnBlock = [ 'core/column', {}, [ getImageBlock() ] ];
		const postContentColumnBlock = [ 'core/column', {}, postContentBlocks ];
		switch ( featuredImageAlignment ) {
			case 'left':
				return [ [ 'core/columns', {}, [ imageColumnBlock, postContentColumnBlock ] ] ];
			case 'right':
				return [ [ 'core/columns', {}, [ postContentColumnBlock, imageColumnBlock ] ] ];
			case 'top':
				return [ getImageBlock( true ), ...postContentBlocks ];
		}
	}
	return postContentBlocks;
};

const createBlockFromTemplate = ( [ name, blockAttributes, innerBlocks = [] ] ) =>
	createBlock( name, blockAttributes, innerBlocks.map( createBlockFromTemplate ) );

const createBlockTemplatesForPosts = ( posts, attributes ) =>
	posts.reduce( ( blocks, post ) => {
		return [ ...blocks, ...createBlockTemplatesForSinglePost( post, attributes ) ];
	}, [] );

const getTemplateBlocks = ( postList, attributes ) =>
	createBlockTemplatesForPosts( postList, attributes ).map( createBlockFromTemplate );

export const getTemplateBlocksMemoized = memoizeOne( getTemplateBlocks, isEqual );

/**
 * Converts a block object to a shape processable by the backend,
 * which contains block's HTML.
 *
 * @param {Object} block block, as understood by the block editor
 * @return {Object} block with innerHTML, processable by the backend
 */
export const convertBlockSerializationFormat = block => ( {
	attrs: omit( block.attributes, 'content' ),
	blockName: block.name,
	innerHTML: getBlockContent( block ),
	innerBlocks: block.innerBlocks.map( convertBlockSerializationFormat ),
} );

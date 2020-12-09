/**
 * External dependencies
 */
import { omit } from 'lodash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { createBlock, getBlockContent } from '@wordpress/blocks';
import { dateI18n, __experimentalGetSettings } from '@wordpress/date';

/**
 * Internal dependencies
 */
import { POSTS_INSERTER_BLOCK_NAME } from './consts';

const assignFontSize = ( fontSize, attributes ) => {
	if ( typeof fontSize === 'number' ) {
		attributes.style = { ...( attributes.style || {} ), typography: { fontSize } };
	} else if ( typeof fontSize === 'string' ) {
		attributes.fontSize = fontSize;
	}
	return attributes;
};

const getHeadingBlockTemplate = ( post, { headingFontSize, headingColor } ) => [
	'core/heading',
	assignFontSize( headingFontSize, {
		style: { color: { text: headingColor } },
		content: `<a href="${ post.link }">${ post.title.rendered }</a>`,
		level: 3,
	} ),
];

const getDateBlockTemplate = ( post, { textFontSize, textColor } ) => {
	const dateFormat = __experimentalGetSettings().formats.date;
	return [
		'core/paragraph',
		assignFontSize( textFontSize, {
			content: dateI18n( dateFormat, post.date_gmt ),
			fontSize: 'normal',
			style: { color: { text: textColor } },
		} ),
	];
};

const getExcerptBlockTemplate = ( post, { excerptLength, textFontSize, textColor } ) => {
	let excerpt = post.excerpt.rendered;
	const excerptElement = document.createElement( 'div' );
	excerptElement.innerHTML = excerpt;
	excerpt = excerptElement.textContent || excerptElement.innerText || '';

	const needsEllipsis = excerptLength < excerpt.trim().split( ' ' ).length;

	const postExcerpt = needsEllipsis
		? `${ excerpt.split( ' ', excerptLength ).join( ' ' ) } […]`
		: excerpt;

	const attributes = { content: postExcerpt.trim(), style: { color: { text: textColor } } };
	return [ 'core/paragraph', assignFontSize( textFontSize, attributes ) ];
};

const getAuthorBlockTemplate = ( post, { textFontSize, textColor } ) => {
	if (
		Array.isArray( post.newspack_author_info ) &&
		post.newspack_author_info.length &&
		post.newspack_author_info[ 0 ].display_name
	) {
		return [
			'core/paragraph',
			assignFontSize( textFontSize, {
				content: __( 'By ', 'newspack-newsletters' ) + post.newspack_author_info[ 0 ].display_name,
				fontSize: 'normal',
				style: { color: { text: textColor } },
			} ),
		];
	}

	return null;
};

const createBlockTemplatesForSinglePost = ( post, attributes ) => {
	const postContentBlocks = [ getHeadingBlockTemplate( post, attributes ) ];

	if ( attributes.displayAuthor ) {
		const author = getAuthorBlockTemplate( post, attributes );

		if ( author ) {
			postContentBlocks.push( author );
		}
	}
	if ( attributes.displayPostDate && post.date_gmt ) {
		postContentBlocks.push( getDateBlockTemplate( post, attributes ) );
	}
	if ( attributes.displayPostExcerpt ) {
		postContentBlocks.push( getExcerptBlockTemplate( post, attributes ) );
	}

	const hasFeaturedImage = post.featuredImageLargeURL || post.featuredImageMediumURL;

	if ( attributes.displayFeaturedImage && hasFeaturedImage ) {
		const getImageBlock = ( alignCenter = false ) => [
			'core/image',
			{
				url: alignCenter ? post.featuredImageLargeURL : post.featuredImageMediumURL,
				href: post.link,
				...( alignCenter ? { align: 'center' } : {} ),
			},
		];
		const imageColumnBlock = [ 'core/column', {}, [ getImageBlock() ] ];
		const postContentColumnBlock = [ 'core/column', {}, postContentBlocks ];
		switch ( attributes.featuredImageAlignment ) {
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

export const getTemplateBlocks = ( postList, attributes ) =>
	createBlockTemplatesForPosts( postList, attributes ).map( createBlockFromTemplate );

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

// In some cases, the Posts Inserter block should not handle deduplication.
// Previews might be displayed next to each other or next to a post, which results in multiple block lists.
// The deduplication store relies on the assumption that a post has a single blocks list, which
// is not true when there are block previews used.
export const setPreventDeduplicationForPostsInserter = blocks =>
	blocks.map( block => {
		if ( block.name === POSTS_INSERTER_BLOCK_NAME ) {
			block.attributes.preventDeduplication = true;
		}
		if ( block.innerBlocks ) {
			block.innerBlocks = setPreventDeduplicationForPostsInserter( block.innerBlocks );
		}
		return block;
	} );

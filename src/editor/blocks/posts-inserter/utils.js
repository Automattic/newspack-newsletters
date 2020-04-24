import { dateI18n, __experimentalGetSettings } from '@wordpress/date';

const getHeadingBlock = post => [
	'core/heading',
	{ content: `<a href="${ post.link }">${ post.title.rendered }</a>`, level: 3 },
];

const getDateBlock = post => {
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

const getExcerptBlock = ( post, { excerptLength } ) => {
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

const createBlocksForPost = (
	post,
	{
		displayPostDate,
		displayPostExcerpt,
		excerptLength,
		displayFeaturedImage,
		featuredImageAlignment,
	}
) => {
	const postContentBlocks = [ getHeadingBlock( post ) ];

	if ( displayPostDate && post.date_gmt ) {
		postContentBlocks.push( getDateBlock( post ) );
	}
	if ( displayPostExcerpt ) {
		postContentBlocks.push( getExcerptBlock( post, { excerptLength } ) );
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

export const getBlocksTemplate = ( posts, attributes ) =>
	posts.reduce( ( blocks, post ) => {
		return [ ...blocks, ...createBlocksForPost( post, attributes ) ];
	}, [] );

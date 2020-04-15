export const getBlocksTemplate = ( posts, { displayPostExcerpt, excerptLength } ) =>
	posts.map( post => {
		const blocks = [
			[
				'core/heading',
				{ content: `<a href="${ post.link }">${ post.title.rendered }</a>`, level: 3 },
			],
		];
		if ( displayPostExcerpt ) {
			let excerpt = post.content.rendered;
			const excerptElement = document.createElement( 'div' );
			excerptElement.innerHTML = excerpt;
			excerpt = excerptElement.textContent || excerptElement.innerText || '';

			const needsEllipsis =
				excerptLength < excerpt.trim().split( ' ' ).length && post.excerpt.raw === '';

			const postExcerpt = needsEllipsis
				? `${ excerpt.split( ' ', excerptLength ).join( ' ' ) } […]`
				: excerpt;

			blocks.push( [ 'core/paragraph', { content: postExcerpt.trim() } ] );
		}
		return blocks;
	} );

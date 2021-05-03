/**
 * External dependencies
 */
import { stringify } from 'qs';

/**
 * WordPress dependencies
 */
import { RichText, useBlockProps } from '@wordpress/block-editor';
import { select } from '@wordpress/data';

export default ( { attributes } ) => {
	let { content, shareMessage } = attributes;
	const { getEditedPostAttribute, getPermalink } = select( 'core/editor' );

	const href = `mailto:?${ stringify( {
		// It'd be cool to include a HTML link in the email body, but that's not possible - https://stackoverflow.com/a/13415988/3772847.
		body: shareMessage.replace( '[LINK]', getPermalink() || '' ),
		// Not really a forwarded email, since the body is a link to the site, but in principle it's a forward.
		subject: 'Fwd: ' + getEditedPostAttribute( 'title' ),
	} ) }`;

	// HACK: The block content contains the anchor element after saving,
	// but not when first inserted in the editor. So here the wrapping anchor
	// is stripped. This will cause a warning in JS console, but no disruption
	// to the editing experience.
	if ( content.indexOf( '<a' ) === 0 ) {
		const el = document.createElement( 'div' );
		el.innerHTML = content;
		content = el.querySelector( 'a' ).innerHTML;
	}

	return (
		<p { ...useBlockProps.save() }>
			<a href={ href }>
				<RichText.Content value={ content } />
			</a>
		</p>
	);
};

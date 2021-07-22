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
	const { content, shareMessage } = attributes;
	const { getEditedPostAttribute } = select( 'core/editor' );

	const href = `mailto:?${ stringify( {
		body: shareMessage,
		subject: getEditedPostAttribute( 'title' ),
	} ) }`;

	return (
		<p { ...useBlockProps.save() }>
			<a href={ href }>
				<RichText.Content value={ content } />
			</a>
		</p>
	);
};

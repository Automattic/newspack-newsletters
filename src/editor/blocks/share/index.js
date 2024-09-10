/**
 * WordPress dependencies
 */
import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { Icon, customLink } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import edit from './edit';
import save from './save';
import { SHARE_BLOCK_NAME } from './consts';

export default () => {
	registerBlockType( SHARE_BLOCK_NAME, {
		title: __( 'Share Newsletter', 'newspack-newsletters' ),
		category: 'newspack',
		icon: <Icon icon={ customLink } />,
		attributes: {
			content: {
				type: 'string',
				source: 'html',
				selector: 'p',
				default: __(
					'Thanks for reading. If you liked it, please send to a friend!',
					'newspack-newsletters'
				),
				__experimentalRole: 'content',
			},
			shareMessage: {
				type: 'string',
				default: __( "I'd like to share this newsletter with you: [LINK]", 'newspack-newsletters' ),
			},
		},
		supports: {
			className: false,
			color: {
				link: true,
			},
			fontSize: true,
			lineHeight: true,
		},
		edit,
		save,
	} );
};

/**
 * WordPress dependencies
 */
import { unregisterBlockStyle } from '@wordpress/blocks';
import domReady from '@wordpress/dom-ready';
import { addFilter } from '@wordpress/hooks';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import './style.scss';
import registerPostsInserterBlock from './blocks/posts-inserter';
import registerShareBlock from './blocks/share';
import registerEmbedBlockEdit from './blocks/embed';
import registerMergeTagsFilters from './blocks/mailchimp-merge-tags';
import { addBlocksValidationFilter } from './blocks-validation/blocks-filters';
import { NestedColumnsDetection } from './blocks-validation/nesting-detection';
import './api';

addBlocksValidationFilter();
registerPostsInserterBlock();
registerShareBlock();

registerEmbedBlockEdit();
registerMergeTagsFilters();

/* Unregister core block styles that are unsupported in emails */
domReady( () => {
	unregisterBlockStyle( 'core/separator', 'dots' );
	unregisterBlockStyle( 'core/social-links', 'logos-only' );
	unregisterBlockStyle( 'core/social-links', 'pill-shape' );
} );

addFilter( 'blocks.registerBlockType', 'newspack-newsletters/core-blocks', ( settings, name ) => {
	/* Remove left/right alignment options wherever possible */
	if ( 'core/paragraph' === name || 'core/buttons' === name || 'core/columns' === name ) {
		settings.supports = { ...settings.supports, align: [] };
	}
	if ( 'core/group' === name ) {
		settings.supports = { ...settings.supports, align: [ 'full' ] };
	}
	return settings;
} );

registerPlugin( 'newspack-newsletters-plugin', {
	render: NestedColumnsDetection,
	icon: null,
} );

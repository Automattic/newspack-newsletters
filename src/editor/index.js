/* globals newspack_email_editor_data */
/**
 * WordPress dependencies
 */
import {
	registerBlockStyle,
	unregisterBlockStyle,
	unregisterBlockVariation,
} from '@wordpress/blocks';
import domReady from '@wordpress/dom-ready';
import { addFilter, removeFilter } from '@wordpress/hooks';
import { registerPlugin } from '@wordpress/plugins';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './style.scss';
import registerPostsInserterBlock from './blocks/posts-inserter';
import registerShareBlock from './blocks/share';
import registerEmbedBlockEdit from './blocks/embed';
import registerMergeTagsFilters from './blocks/mailchimp-merge-tags';
import registerVisibilityFilters from './blocks/visibility-attribute';
import registerConditionalContent from './blocks/conditional-content';
import { addBlocksValidationFilter } from './blocks-validation/blocks-filters';
import { NestedColumnsDetection } from './blocks-validation/nesting-detection';
import './api';

addBlocksValidationFilter();
registerPostsInserterBlock();
registerShareBlock();

registerEmbedBlockEdit();
registerMergeTagsFilters();
registerVisibilityFilters();

if (
	newspack_email_editor_data.conditional_tag_support &&
	newspack_email_editor_data.conditional_tag_support.support_url
) {
	registerConditionalContent();
}

domReady( () => {
	/* Unregister core block styles that are unsupported in emails */
	unregisterBlockStyle( 'core/separator', 'dots' );
	unregisterBlockStyle( 'core/social-links', 'logos-only' );
	unregisterBlockStyle( 'core/social-links', 'pill-shape' );
	/* Unregister "row" group block variation */
	unregisterBlockVariation( 'core/group', 'group-row' );
} );

/* Remove Duotone filters */
removeFilter( 'blocks.registerBlockType', 'core/editor/duotone/add-attributes' );
removeFilter( 'editor.BlockEdit', 'core/editor/duotone/with-editor-controls' );
removeFilter( 'editor.BlockListBlock', 'core/editor/duotone/with-styles' );

addFilter( 'blocks.registerBlockType', 'newspack-newsletters/core-blocks', ( settings, name ) => {
	/* Remove left/right alignment options wherever possible */
	if (
		'core/paragraph' === name ||
		'core/buttons' === name ||
		'core/columns' === name ||
		'core/separator' === name
	) {
		settings.supports = { ...settings.supports, align: [] };
	}
	if ( 'core/group' === name ) {
		settings.supports = { ...settings.supports, align: [ 'full' ] };
	}
	return settings;
} );

registerBlockStyle( 'core/social-links', {
	name: 'circle-black',
	label: __( 'Circle Black', 'newspack-newsletters' ),
} );

registerBlockStyle( 'core/social-links', {
	name: 'circle-white',
	label: __( 'Circle White', 'newspack-newsletters' ),
} );

registerBlockStyle( 'core/social-links', {
	name: 'filled-black',
	label: __( 'Black', 'newspack-newsletters' ),
} );

registerBlockStyle( 'core/social-links', {
	name: 'filled-white',
	label: __( 'White', 'newspack-newsletters' ),
} );

registerPlugin( 'newspack-newsletters-plugin', {
	render: NestedColumnsDetection,
	icon: null,
} );

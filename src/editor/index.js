/**
 * WordPress dependencies
 */
import domReady from '@wordpress/dom-ready';
import { unregisterBlockStyle } from '@wordpress/blocks';
import { PluginDocumentSettingPanel, PluginPrePublishPanel } from '@wordpress/edit-post';
import { __ } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import Sidebar from './sidebar/';
import Editor from './editor/';
import PrePublishSlot from './pre-publish-slot';

/* Unregister core block styles that are unsupported in emails */
domReady( () => {
	unregisterBlockStyle( 'core/separator', 'dots' );
	unregisterBlockStyle( 'core/social-links', 'logos-only' );
	unregisterBlockStyle( 'core/social-links', 'pill-shape' );
} );

addFilter( 'blocks.registerBlockType', 'newspack-newsletters/core-blocks', ( settings, name ) => {
	/* Remove left/right alignment options wherever possible */
	if (
		'core/paragraph' === name ||
		'core/social-links' === name ||
		'core/buttons' === name ||
		'core/columns' === name
	) {
		settings.supports = { ...settings.supports, align: [] };
	}
	return settings;
} );

registerPlugin( 'newspack-newsletters-sidebar', {
	render: () => (
		<PluginDocumentSettingPanel
			name="newsletters-settings-panel"
			title={ __( ' Newsletter Settings', 'newspack-newsletters' ) }
		>
			<Sidebar />
		</PluginDocumentSettingPanel>
	),
	icon: null,
} );

registerPlugin( 'newspack-newsletters-pre-publish', {
	render: () => (
		<PluginPrePublishPanel>
			<PrePublishSlot />
		</PluginPrePublishPanel>
	),
	icon: null,
} );

registerPlugin( 'newspack-newsletters-edit', {
	render: Editor,
} );

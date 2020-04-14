/**
 * WordPress dependencies
 */
import { parse, unregisterBlockStyle } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Fragment, useState } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import { PluginDocumentSettingPanel, PluginPrePublishPanel } from '@wordpress/edit-post';
import { addFilter } from '@wordpress/hooks';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import TemplateModal from '../components/template-modal';
import Sidebar from './sidebar/';
import Editor from './editor/';
import PrePublishSlot from './pre-publish-slot';

import { addBlocksValidationFilter } from './blocks-validation/blocks-filters';
import { NestedColumnsDetection } from './blocks-validation/nested-columns-detection';

addBlocksValidationFilter();

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

const NewsletterEdit = ( {
	getBlocks,
	insertBlocks,
	replaceBlocks,
	isEditedPostNew,
	savePost,
} ) => {
	const templates =
		window && window.newspack_newsletters_data && window.newspack_newsletters_data.templates;

	const [ selectedTemplate, setSelectedTemplate ] = useState( 0 );
	const [ insertedTemplate, setInserted ] = useState( null );

	const handleTemplateInsertion = templateIndex => {
		const template = templates[ templateIndex ];
		const clientIds = getBlocks().map( ( { clientId } ) => clientId );
		if ( clientIds && clientIds.length ) {
			replaceBlocks( clientIds, parse( template.content ) );
		} else {
			insertBlocks( parse( template.content ) );
		}
		setInserted( templateIndex );
		setTimeout( savePost, 1 );
	};

	const isDisplayingTemplateModal =
		isEditedPostNew && templates && templates.length && insertedTemplate === null;

	return isDisplayingTemplateModal ? (
		<TemplateModal
			templates={ templates }
			onInsertTemplate={ handleTemplateInsertion }
			onSelectTemplate={ setSelectedTemplate }
			selectedTemplate={ selectedTemplate }
		/>
	) : (
		<Fragment>
			<NestedColumnsDetection />
			<PluginDocumentSettingPanel
				name="newsletters-settings-panel"
				title={ __( ' Newsletter Settings', 'newspack-newsletters' ) }
			>
				<Sidebar />
			</PluginDocumentSettingPanel>
		</Fragment>
	);
};

const NewsletterEditWithSelect = compose( [
	withSelect( select => {
		const { isEditedPostNew } = select( 'core/editor' );
		const { getBlocks } = select( 'core/block-editor' );
		return {
			isEditedPostNew: isEditedPostNew(),
			getBlocks,
		};
	} ),
	withDispatch( dispatch => {
		const { savePost } = dispatch( 'core/editor' );
		const { insertBlocks, replaceBlocks } = dispatch( 'core/block-editor' );
		return { savePost, insertBlocks, replaceBlocks };
	} ),
] )( NewsletterEdit );

registerPlugin( 'newspack-newsletters-sidebar', {
	render: NewsletterEditWithSelect,
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

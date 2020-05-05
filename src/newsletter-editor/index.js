/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Fragment, useState } from '@wordpress/element';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import TemplateModal from '../components/template-modal';
import Layout from './layout/';
import Sidebar from './sidebar/';
import Testing from './testing/';
import registerEditorPlugin from './editor/';

registerEditorPlugin();

const NewsletterEdit = ( {
	getBlocks,
	insertBlocks,
	replaceBlocks,
	savePost,
	setTemplateIDMeta,
	templateId,
} ) => {
	const templates =
		window && window.newspack_newsletters_data && window.newspack_newsletters_data.templates;

	const [ hasKeys, setHasKeys ] = useState(
		window && window.newspack_newsletters_data && window.newspack_newsletters_data.has_keys
	);

	const handleTemplateInsertion = templateIndex => {
		const template = templates[ templateIndex ];
		const clientIds = getBlocks().map( ( { clientId } ) => clientId );
		if ( clientIds && clientIds.length ) {
			replaceBlocks( clientIds, parse( template.content ) );
		} else {
			insertBlocks( parse( template.content ) );
		}
		setTemplateIDMeta( templateIndex );
		setTimeout( savePost, 1 );
	};
	const isDisplayingTemplateModal = ! hasKeys || -1 === templateId;

	return isDisplayingTemplateModal ? (
		<TemplateModal
			templates={ templates }
			onInsertTemplate={ handleTemplateInsertion }
			hasKeys={ hasKeys }
			onSetupStatus={ status => setHasKeys( status ) }
		/>
	) : (
		<Fragment>
			<PluginDocumentSettingPanel
				name="newsletters-settings-panel"
				title={ __( 'Newsletter', 'newspack-newsletters' ) }
			>
				<Sidebar />
			</PluginDocumentSettingPanel>
			<PluginDocumentSettingPanel
				name="newsletters-testing-panel"
				title={ __( 'Testing', 'newspack-newsletters' ) }
			>
				<Testing />
			</PluginDocumentSettingPanel>
			<PluginDocumentSettingPanel
				name="newsletters-layout-panel"
				title={ __( 'Layout', 'newspack-newsletters' ) }
			>
				<Layout templates={ templates } />
			</PluginDocumentSettingPanel>
		</Fragment>
	);
};

const NewsletterEditWithSelect = compose( [
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		const { template_id: templateId } = meta;
		const { getBlocks } = select( 'core/block-editor' );
		return {
			getBlocks,
			templateId,
		};
	} ),
	withDispatch( dispatch => {
		const { savePost } = dispatch( 'core/editor' );
		const { insertBlocks, replaceBlocks } = dispatch( 'core/block-editor' );
		return {
			savePost,
			insertBlocks,
			replaceBlocks,
			setTemplateIDMeta: templateId =>
				dispatch( 'core/editor' ).editPost( { meta: { template_id: templateId } } ),
		};
	} ),
] )( NewsletterEdit );

registerPlugin( 'newspack-newsletters-sidebar', {
	render: NewsletterEditWithSelect,
	icon: null,
} );

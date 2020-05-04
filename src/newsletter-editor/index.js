/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { withSelect } from '@wordpress/data';
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

const NewsletterEdit = ( { templateId } ) => {
	const [ hasKeys, setHasKeys ] = useState(
		window && window.newspack_newsletters_data && window.newspack_newsletters_data.has_keys
	);

	const isDisplayingTemplateModal = ! hasKeys || -1 === templateId;

	return isDisplayingTemplateModal ? (
		<TemplateModal hasKeys={ hasKeys } onSetupStatus={ setHasKeys } />
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
				<Layout />
			</PluginDocumentSettingPanel>
		</Fragment>
	);
};

const NewsletterEditWithSelect = compose( [
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return { templateId: meta.template_id };
	} ),
] )( NewsletterEdit );

registerPlugin( 'newspack-newsletters-sidebar', {
	render: NewsletterEditWithSelect,
	icon: null,
} );

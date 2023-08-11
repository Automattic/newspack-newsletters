/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useSelect, useDispatch } from '@wordpress/data';
import { Fragment } from '@wordpress/element';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import { CheckboxControl } from '@wordpress/components';

function NewslettersAdsSettings() {
	const { disableAutoAds } = useSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return { disableAutoAds: meta.disable_auto_ads };
	} );
	const { editPost } = useDispatch( 'core/editor' );
	return (
		<Fragment>
			<PluginDocumentSettingPanel
				name="newsletters-ads-settings-panel"
				title={ __( 'Ads Settings', 'newspack-newsletters' ) }
			>
				<CheckboxControl
					label={ __( 'Disable automatic insertion of ads', 'newspack-newsletters' ) }
					checked={ disableAutoAds }
					onChange={ disable_auto_ads => editPost( { meta: { disable_auto_ads } } ) }
				/>
			</PluginDocumentSettingPanel>
		</Fragment>
	);
}

registerPlugin( 'newspack-newsletters-ads-settings', {
	render: NewslettersAdsSettings,
	icon: null,
} );

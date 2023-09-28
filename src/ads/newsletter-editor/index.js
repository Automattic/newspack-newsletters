/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import DisableAutoAds from './disable-auto-ads';

function NewslettersAdsSettings() {
	return (
		<PluginDocumentSettingPanel
			name="newsletters-ads-settings-panel"
			title={ __( 'Ads Settings', 'newspack-newsletters' ) }
		>
			<DisableAutoAds />
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'newspack-newsletters-ads-settings', {
	render: NewslettersAdsSettings,
	icon: null,
} );

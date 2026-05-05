/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useSelect, useDispatch } from '@wordpress/data';
import { Fragment, useEffect, useState } from '@wordpress/element';
import { PluginDocumentSettingPanel, PluginSidebar, PluginSidebarMoreMenuItem, PluginPostStatusInfo } from '@wordpress/editor';
import { registerPlugin } from '@wordpress/plugins';
import { styles } from '@wordpress/icons';
// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
import { __experimentalVStack as VStack } from '@wordpress/components';

/**
 * Internal dependencies
 */
import InitModal from '../components/init-modal';
import { getServiceProvider } from '../service-providers';
import Layout from './layout/';
import Sidebar from './sidebar/';
import Testing from './testing/';
import { Styling, ApplyStyling } from './styling/';
import { PublicSettings } from './public';
import registerEditorPlugin from './editor/';
import withApiHandler from '../components/with-api-handler';
import { registerStore, fetchNewsletterData, useNewsletterDataError } from './store';
import { isLayoutEditor, isManualESP, isSupportedESP } from './utils';
import CampaignLink from './campaign-link';
import './debug-send';

registerStore();
// Layouts share the editor but must never render the send button — skip the
// plugin that mounts it next to the publish action.
if ( ! isLayoutEditor() ) {
	registerEditorPlugin();
}

function NewsletterEdit( { apiFetchWithErrorHandling, setInFlightForAsync, inFlight } ) {
	const { layoutId, postId } = useSelect( select => {
		const { getCurrentPostId, getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			layoutId: meta.template_id,
			postId: getCurrentPostId(),
		};
	} );
	const [ shouldDisplaySettings, setShouldDisplaySettings ] = useState( window?.newspack_newsletters_data?.is_service_provider_configured !== '1' );
	const [ testEmail, setTestEmail ] = useState( window?.newspack_newsletters_data?.user_test_emails?.join( ',' ) || '' );
	const [ isConnected, setIsConnected ] = useState( null );
	const [ oauthUrl, setOauthUrl ] = useState( null );
	const newsletterDataError = useNewsletterDataError();
	const savePost = useDispatch( 'core/editor' ).savePost;
	const { createNotice, removeNotice } = useDispatch( 'core/notices' );
	const { name: serviceProviderName, hasOauth } = getServiceProvider();

	const verifyToken = () => {
		if ( isSupportedESP() && hasOauth ) {
			const params = {
				path: `/newspack-newsletters/v1/${ serviceProviderName }/verify_token`,
				method: 'GET',
			};
			setInFlightForAsync();
			apiFetchWithErrorHandling( params ).then( async response => {
				if ( false === isConnected && true === response.valid ) {
					savePost();
				}
				setOauthUrl( response.auth_url );
				setIsConnected( response.valid );
			} );
		}
	};

	useEffect( () => {
		// Fetch provider and campaign data. Layouts have no associated ESP
		// campaign — skip the fetch to avoid noisy 404s.
		if ( isSupportedESP() && ! isLayoutEditor() ) {
			fetchNewsletterData( postId );
		}
	}, [] );

	useEffect( () => {
		if ( ! isConnected && hasOauth ) {
			verifyToken();
		} else {
			setIsConnected( true );
		}
	}, [ serviceProviderName ] );

	// Handle error messages from retrieve/sync requests with connected ESP.
	useEffect( () => {
		if ( newsletterDataError ) {
			createNotice( 'error', newsletterDataError?.message || __( 'Error communicating with service provider.', 'newspack-newsletters' ), {
				id: 'newspack-newsletters-newsletter-data-error',
				isDismissible: true,
			} );
		} else {
			removeNotice( 'newspack-newsletters-newsletter-data-error' );
		}
	}, newsletterDataError );

	const isLayout = isLayoutEditor();
	// Layouts intentionally don't depend on a connected ESP — the test-send
	// path goes through `wp_mail`, the styling sidebar is provider-agnostic,
	// and an unconfigured site should still be able to author layouts.
	// Bail only for non-layout editors when no provider is supported.
	if ( ! isLayout && ! isSupportedESP() ) {
		return null;
	}
	// Layouts have no template to pick — they ARE templates. The init modal
	// is for ESP setup only in layout mode.
	const isDisplayingInitModal = shouldDisplaySettings || ( ! isLayout && -1 === layoutId );
	const stylingId = 'newspack-newsletters-styling';
	const stylingTitle = isLayout ? __( 'Layout Global Styles', 'newspack-newsletters' ) : __( 'Newsletter Global Styles', 'newspack-newsletters' );

	return isDisplayingInitModal ? (
		<InitModal shouldDisplaySettings={ shouldDisplaySettings } onSetupStatus={ setShouldDisplaySettings } />
	) : (
		<Fragment>
			<PluginSidebar name={ stylingId } icon={ styles } title={ stylingTitle }>
				<Styling />
			</PluginSidebar>
			<PluginSidebarMoreMenuItem target={ stylingId } icon={ styles }>
				{ stylingTitle }
			</PluginSidebarMoreMenuItem>

			{ ! isLayout && <PluginPostStatusInfo>{ isConnected && <PublicSettings /> }</PluginPostStatusInfo> }

			{ ! isLayout && isSupportedESP() && ! isManualESP() && (
				<PluginDocumentSettingPanel name="newsletters-settings-panel" title={ __( 'Newsletter Campaign', 'newspack-newsletters' ) }>
					<VStack spacing={ 4 }>
						<CampaignLink />
						<Sidebar inFlight={ inFlight } isConnected={ isConnected } oauthUrl={ oauthUrl } onAuthorize={ verifyToken } />
					</VStack>
				</PluginDocumentSettingPanel>
			) }

			{ /* Testing panel: newsletters require a configured + connected ESP
			 * (the per-provider `/test` route lives at the campaign object).
			 * Layouts route through a layout-specific endpoint that wp_mails
			 * the rendered HTML directly, so they don't need any ESP gate. */ }
			{ ( isLayout || ( isSupportedESP() && ! isManualESP() ) ) && (
				<PluginDocumentSettingPanel name="newsletters-testing-panel" title={ __( 'Testing', 'newspack-newsletters' ) }>
					<Testing testEmail={ testEmail } onChangeEmail={ setTestEmail } disabled={ ! isLayout && ! isConnected } />
				</PluginDocumentSettingPanel>
			) }

			{ ! isLayout && (
				<PluginDocumentSettingPanel name="newsletters-layout-panel" title={ __( 'Layout', 'newspack-newsletters' ) }>
					<Layout />
				</PluginDocumentSettingPanel>
			) }

			{ ! isLayout && <ApplyStyling /> }
		</Fragment>
	);
}

registerPlugin( 'newspack-newsletters-sidebar', {
	render: withApiHandler()( NewsletterEdit ),
	icon: null,
} );

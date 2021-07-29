/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Fragment, useEffect, useState } from '@wordpress/element';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';

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

registerEditorPlugin();

const NewsletterEdit = ( {
	apiFetchWithErrorHandling,
	setInFlightForAsync,
	savePost,
	layoutId,
} ) => {
	const [ shouldDisplaySettings, setShouldDisplaySettings ] = useState(
		window?.newspack_newsletters_data?.is_service_provider_configured !== '1'
	);
	const [ testEmail, setTestEmail ] = useState(
		window?.newspack_newsletters_data?.user_test_emails?.join( ',' ) || ''
	);
	const [ isConnected, setIsConnected ] = useState( null );
	const [ oauthUrl, setOauthUrl ] = useState( null );

	const { name: serviceProviderName, hasOauth } = getServiceProvider();

	const verifyToken = () => {
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
	};

	useEffect(() => {
		if ( ! isConnected && hasOauth ) {
			verifyToken();
		} else {
			setIsConnected( true );
		}
	}, [ serviceProviderName ]);

	const isDisplayingInitModal = shouldDisplaySettings || -1 === layoutId;

	return isDisplayingInitModal ? (
		<InitModal
			shouldDisplaySettings={ shouldDisplaySettings }
			onSetupStatus={ setShouldDisplaySettings }
		/>
	) : (
		<Fragment>
			<PluginDocumentSettingPanel
				name="newsletters-settings-panel"
				title={ __( 'Newsletter', 'newspack-newsletters' ) }
			>
				<Sidebar isConnected={ isConnected } oauthUrl={ oauthUrl } onAuthorize={ verifyToken } />
				{ isConnected && <PublicSettings /> }
			</PluginDocumentSettingPanel>
			<PluginDocumentSettingPanel
				name="newsletters-styling-panel"
				title={ __( 'Styling', 'newspack-newsletters' ) }
			>
				<Styling />
			</PluginDocumentSettingPanel>
			{ 'manual' !== serviceProviderName && (
				<PluginDocumentSettingPanel
					name="newsletters-testing-panel"
					title={ __( 'Testing', 'newspack-newsletters' ) }
				>
					<Testing
						testEmail={ testEmail }
						onChangeEmail={ setTestEmail }
						disabled={ ! isConnected }
					/>
				</PluginDocumentSettingPanel>
			) }
			<PluginDocumentSettingPanel
				name="newsletters-layout-panel"
				title={ __( 'Layout', 'newspack-newsletters' ) }
			>
				<Layout />
			</PluginDocumentSettingPanel>

			<ApplyStyling />
		</Fragment>
	);
};

const NewsletterEditWithSelect = compose( [
	withApiHandler(),
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return { layoutId: meta.template_id };
	} ),
	withDispatch( dispatch => {
		const { savePost } = dispatch( 'core/editor' );
		return {
			savePost,
		};
	} ),
] )( NewsletterEdit );

registerPlugin( 'newspack-newsletters-sidebar', {
	render: NewsletterEditWithSelect,
	icon: null,
} );

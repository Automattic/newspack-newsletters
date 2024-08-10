/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useSelect, useDispatch } from '@wordpress/data';
import { Fragment, useEffect, useState } from '@wordpress/element';
import {
	PluginDocumentSettingPanel,
	PluginSidebar,
	PluginSidebarMoreMenuItem,
} from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import { styles } from '@wordpress/icons';
import { addQueryArgs } from '@wordpress/url';

/**
 * Internal dependencies
 */
import InitModal from '../components/init-modal';
import { getServiceProvider } from '../service-providers';
import Layout from './layout/';
import Sidebar from './sidebar/';
import SendTo from './sidebar/send-to';
import Testing from './testing/';
import { Styling, ApplyStyling } from './styling/';
import { PublicSettings } from './public';
import registerEditorPlugin from './editor/';
import withApiHandler from '../components/with-api-handler';
import { registerStore, updateNewsletterData } from './store';
import './debug-send';

/**
 * External dependencies
 */
import { debounce } from 'lodash';

registerStore();
registerEditorPlugin();

function NewsletterEdit( { apiFetchWithErrorHandling, setInFlightForAsync, inFlight } ) {
	const [ sendLists, setSendLists ] = useState( [] );
	const { layoutId, postId, sendTo } = useSelect( select => {
		const { getCurrentPostId, getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			layoutId: meta.template_id,
			postId: getCurrentPostId(),
			sendTo: meta.send_to,
		};
	} );
	const savePost = useDispatch( 'core/editor' ).savePost;
	const editPost = useDispatch( 'core/editor' ).editPost;
	const updateMeta = ( meta ) => editPost( { meta } );

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

	useEffect( () => {
		// Fetch provider campaign data and update meta if necessary.
		if ( 'manual' !== serviceProviderName ) {
			fetchCampaign();
		}

		return () => {
			fetchSendLists.cancel();
		}
	}, [] );

	useEffect( () => {
		if ( ! isConnected && hasOauth ) {
			verifyToken();
		} else {
			setIsConnected( true );
		}
	}, [ serviceProviderName ] );

	const fetchCampaign = async () => {
		const response = await apiFetchWithErrorHandling( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/retrieve`,
		} );
		updateNewsletterData( response );
	};

	// Fetch send lists for the "Send To" UI.
	const fetchSendLists = debounce( async ( search = '', type = null, parentId = null, limit = null, provider = null ) => {
		// If we already have a matching result, no need to fetch more.
		const foundItem = sendLists.find( item => item.id === search || item.label.includes( search ) );
		if ( foundItem ) {
			return;
		}

		const response = await apiFetchWithErrorHandling( {
			path: addQueryArgs(
				'/newspack-newsletters/v1/send-lists',
				{ search, type, parentId, limit, provider }
			)
		} );

		const updatedSendLists = [ ...sendLists ];
		response.forEach( item => {
			if ( ! updatedSendLists.find( listItem => listItem.id === item.id ) ) {
				updatedSendLists.push( item );
			}
		} );

		setSendLists( updatedSendLists );
	}, 500 );

	const isDisplayingInitModal = shouldDisplaySettings || -1 === layoutId;

	const stylingId = 'newspack-newsletters-styling';
	const stylingTitle = __( 'Newsletter Styles', 'newspack-newsletters' );

	return isDisplayingInitModal ? (
		<InitModal
			shouldDisplaySettings={ shouldDisplaySettings }
			onSetupStatus={ setShouldDisplaySettings }
		/>
	) : (
		<Fragment>
			<PluginSidebar name={ stylingId } icon={ styles } title={ stylingTitle }>
				<Styling />
			</PluginSidebar>
			<PluginSidebarMoreMenuItem target={ stylingId } icon={ styles }>
				{ stylingTitle }
			</PluginSidebarMoreMenuItem>

			<PluginDocumentSettingPanel
				name="newsletters-settings-panel"
				title={ __( 'Newsletter', 'newspack-newsletters' ) }
			>
				<Sidebar isConnected={ isConnected } oauthUrl={ oauthUrl } onAuthorize={ verifyToken } />
				{
					'manual' !== serviceProviderName && (
						<SendTo
							fetchSendLists={ fetchSendLists }
							inFlight={ inFlight }
							selected={ sendTo || {} }
							sendLists={ sendLists }
							updateMeta={ updateMeta }
						/>
					)
				}
				{ isConnected && <PublicSettings /> }
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
}

registerPlugin( 'newspack-newsletters-sidebar', {
	render: withApiHandler()( NewsletterEdit ),
	icon: null,
} );

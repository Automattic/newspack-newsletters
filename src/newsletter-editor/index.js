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
import { registerStore, fetchNewsletterData, updateNewsletterData, useNewsletterData } from './store';
import './debug-send';

/**
 * External dependencies
 */
import { debounce, sortBy } from 'lodash';

registerStore();
registerEditorPlugin();

function NewsletterEdit( { apiFetchWithErrorHandling, setInFlightForAsync, inFlight } ) {
	const { layoutId, postId, sendTo } = useSelect( select => {
		const { getCurrentPostId, getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			layoutId: meta.template_id,
			postId: getCurrentPostId(),
			sendTo: meta.send_to,
		};
	} );
	const [ shouldDisplaySettings, setShouldDisplaySettings ] = useState(
		window?.newspack_newsletters_data?.is_service_provider_configured !== '1'
	);
	const [ testEmail, setTestEmail ] = useState(
		window?.newspack_newsletters_data?.user_test_emails?.join( ',' ) || ''
	);
	const [ isConnected, setIsConnected ] = useState( null );
	const [ oauthUrl, setOauthUrl ] = useState( null );
	const newsletterData = useNewsletterData();
	const savePost = useDispatch( 'core/editor' ).savePost;
	const editPost = useDispatch( 'core/editor' ).editPost;
	const updateMeta = ( meta ) => editPost( { meta } );

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
		// Fetch provider and campaign data.
		if ( 'manual' !== serviceProviderName ) {
			fetchNewsletterData( postId );
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

	// Fetch send lists for the "Send To" UI and update the newsletterData store.
	const fetchSendLists = debounce( async ( search = '', type = 'list', parentId = null, limit = null, provider = null ) => {
		if ( ! newsletterData?.lists ) {
			return;
		}

		const sendLists = 'list' === type ? newsletterData.lists : newsletterData.sublists;

		// If we already have a matching result, no need to fetch more.
		const foundItem = sendLists.find( item => item.id === search || item.label.toLowerCase().includes( search.toLowerCase() ) );
		if ( foundItem ) {
			return;
		}

		const response = await apiFetchWithErrorHandling( {
			path: addQueryArgs(
				'/newspack-newsletters/v1/send-lists',
				{ search, type, parentId, limit, provider }
			)
		} );

		const updatedNewsletterData = { ...newsletterData };
		const updatedSendLists = [ ...sendLists ];
		response.forEach( item => {
			if ( ! updatedSendLists.find( listItem => listItem.id === item.id ) ) {
				updatedSendLists.push( item );
			}
		} );
		if ( 'list' === type ) {
			updatedNewsletterData.lists = sortBy( updatedSendLists, 'label' );
		} else {
			updatedNewsletterData.sublists = sortBy( updatedSendLists, 'label' );
		}

		updateNewsletterData( updatedNewsletterData );
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

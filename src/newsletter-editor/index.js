/* global newspack_email_editor_data */

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
import SendTo from './sidebar/send-to';
import InitModal from '../components/init-modal';
import { getServiceProvider } from '../service-providers';
import Layout from './layout/';
import Sidebar from './sidebar/';
import Testing from './testing/';
import { Styling, ApplyStyling } from './styling/';
import { PublicSettings } from './public';
import registerEditorPlugin from './editor/';
import withApiHandler from '../components/with-api-handler';
import { registerStore, fetchNewsletterData, updateNewsletterData, useNewsletterData, useNewsletterDataError } from './store';
import './debug-send';

/**
 * External dependencies
 */
import { debounce, sortBy } from 'lodash';

registerStore();
registerEditorPlugin();

function NewsletterEdit( { apiFetchWithErrorHandling, setInFlightForAsync, inFlight } ) {
	const { layoutId, postId, status } = useSelect( select => {
		const { getCurrentPostAttribute, getCurrentPostId, getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			layoutId: meta.template_id,
			postId: getCurrentPostId(),
			status: getCurrentPostAttribute( 'status' ),
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
	const newsletterDataError = useNewsletterDataError();
	const savePost = useDispatch( 'core/editor' ).savePost;
	const { createNotice, removeNotice } = useDispatch( 'core/notices' );
	const { name: serviceProviderName, hasOauth, isCampaignSent } = getServiceProvider();
	const campaignIsSent = ! inFlight && newsletterData && isCampaignSent && isCampaignSent( newsletterData, status );
	const { supported_esps: suppportedESPs } = newspack_email_editor_data || {};
	const isSupportedESP = serviceProviderName && 'manual' !== serviceProviderName && suppportedESPs?.includes( serviceProviderName );

	const verifyToken = () => {
		if ( isSupportedESP && hasOauth ) {
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
		// Fetch provider and campaign data.
		if ( isSupportedESP ) {
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

	// Handle error messages from retrieve/sync requests with connected ESP.
	useEffect( () => {
		if ( newsletterDataError ) {
			createNotice( 'error', newsletterDataError?.message || __( 'Error communicating with service provider.', 'newspack-newseltters' ), {
				id: 'newspack-newsletters-newsletter-data-error',
				isDismissible: true,
			} );
		} else {
			removeNotice( 'newspack-newsletters-newsletter-data-error' );
		}
	}, newsletterDataError );

	// Fetch send lists for the "Send To" UI and update the newsletterData store.
	const fetchSendLists = debounce( async ( opts = {} ) => {
		const args = {
			type: 'list',
			limit: 10,
			provider: serviceProviderName,
			...opts,
		};

		const sendLists = 'list' === args.type ? [ ...newsletterData?.lists ] || [] : [ ...newsletterData?.sublists ] || [];

		// If we already have a matching result, no need to fetch more.
		const foundItems = sendLists.filter( item => {
			const ids = args.ids && ! Array.isArray( args.ids ) ? [ args.ids ] : args.ids;
			const search = args.search && ! Array.isArray( args.search ) ? [ args.search ] : args.search;
			let found = false;
			if ( ids?.length ) {
				ids.forEach( id => {
					found = item.id.toString() === id.toString();
				} )
			}
			if ( search?.length ) {
				search.forEach( term => {
					if ( item.label.toLowerCase().includes( term.toLowerCase() ) ) {
						found = true;
					}
				} );
			}

			return found;
		} );

		if ( foundItems.length ) {
			return sendLists;
		}

		const response = await apiFetchWithErrorHandling( {
			path: addQueryArgs(
				'/newspack-newsletters/v1/send-lists',
				args
			)
		} );

		const updatedNewsletterData = { ...newsletterData };
		const updatedSendLists = [ ...sendLists ];
		response.forEach( item => {
			if ( ! updatedSendLists.find( listItem => listItem.id === item.id ) ) {
				updatedSendLists.push( item );
			}
		} );
		if ( 'list' === args.type ) {
			updatedNewsletterData.lists = sortBy( updatedSendLists, 'label' );
		} else {
			updatedNewsletterData.sublists = sortBy( updatedSendLists, 'label' );
		}

		updateNewsletterData( updatedNewsletterData );
		return updatedSendLists;
	}, 500 );

	if ( ! isSupportedESP ) {
		return null;
	}

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
				<Sidebar
					fetchSendLists={ fetchSendLists }
					inFlight={ inFlight }
					isConnected={ isConnected }
					oauthUrl={ oauthUrl }
					onAuthorize={ verifyToken }
				/>
				{
					isSupportedESP && ! campaignIsSent && (
						<SendTo
							fetchSendLists={ fetchSendLists }
							inFlight={ inFlight }
						/>
					)
				}
				{ isConnected && <PublicSettings /> }
			</PluginDocumentSettingPanel>
			{ isSupportedESP && (
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

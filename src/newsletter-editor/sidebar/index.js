/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { Button, Spinner, TextControl, TextareaControl } from '@wordpress/components';

/**
 * External dependencies
 */
import { once } from 'lodash';

/**
 * Internal dependencies
 */
import Sender from './sender';
import { getServiceProvider } from '../../service-providers';
import withApiHandler from '../../components/with-api-handler';
import { useNewsletterData } from '../store';
import './style.scss';

const Sidebar = ( {
	isConnected,
	oauthUrl,
	onAuthorize,
	inFlight,
	errors,
	editPost,
	title,
	senderEmail,
	senderName,
	campaignName,
	previewText,
	stringifiedCampaignDefaults,
	postId,
} ) => {
	const newsletterData = useNewsletterData();
	const campaign = newsletterData?.campaign;
	const updateMeta = ( meta ) => editPost( { meta } );

	// Reconcile stored campaign data with data fetched from ESP.
	useEffect( () => {
		const updatedMeta = {};
		if ( newsletterData?.senderEmail ) {
			updatedMeta.senderEmail = newsletterData.senderEmail;
		}
		if ( newsletterData?.senderName ) {
			updatedMeta.senderName = newsletterData.senderName;
		}
		if ( newsletterData?.send_list_id ) {
			updatedMeta.send_list_id = newsletterData.send_list_id;
		}
		if ( newsletterData?.send_sublist_id ) {
			updatedMeta.send_sublist_id = newsletterData.send_sublist_id;
		}
		if ( Object.keys( updatedMeta ).length ) {
			updateMeta( updatedMeta );
		}
	}, [ newsletterData ] );

	useEffect( () => {
		const campaignDefaults = 'string' === typeof stringifiedCampaignDefaults ? JSON.parse( stringifiedCampaignDefaults ) : stringifiedCampaignDefaults;
		const updatedMeta = {};
		if ( campaignDefaults?.senderEmail ) {
			updatedMeta.senderEmail = campaignDefaults.senderEmail;
		}
		if ( campaignDefaults?.senderName ) {
			updatedMeta.senderName = campaignDefaults.senderName;
		}
		if ( campaignDefaults?.send_list_id ) {
			updatedMeta.send_list_id = campaignDefaults.send_list_id;
		}
		if ( campaignDefaults?.send_sublist_id ) {
			updatedMeta.send_sublist_id = campaignDefaults.send_sublist_id;
		}
		if ( Object.keys( updatedMeta ).length ) {
			updateMeta( updatedMeta );
		}
	}, [ stringifiedCampaignDefaults ] );

	const getCampaignName = () => {
		if ( typeof campaignName === 'string' ) {
			return campaignName;
		}
		return 'Newspack Newsletter (' + postId + ')';
	};

	if ( false === isConnected ) {
		return (
			<>
				<p>
					{ __(
						'You must authorize your account before publishing your newsletter.',
						'newspack-newsletters'
					) }
				</p>
				<Button
					isPrimary
					disabled={ inFlight }
					onClick={ () => {
						const authWindow = window.open( oauthUrl, 'esp_oauth', 'width=500,height=600' );
						authWindow.opener = { verify: once( onAuthorize ) };
					} }
				>
					{ __( 'Authorize', 'newspack-newsletter' ) }
				</Button>
			</>
		);
	}

	if ( ! campaign ) {
		return (
			<div className="newspack-newsletters__loading-data">
				{ __( 'Retrieving campaign data…', 'newspack-newsletters' ) }
				<Spinner />
			</div>
		);
	}

	const { ProviderSidebar = () => null } = getServiceProvider();
	return (
		<div className="newspack-newsletters__sidebar">
			<TextControl
				label={ __( 'Campaign Name', 'newspack-newsletters' ) }
				className="newspack-newsletters__campaign-name-textcontrol"
				value={ getCampaignName() }
				placeholder={ 'Newspack Newsletter (' + postId + ')' }
				disabled={ inFlight }
				onChange={ value => updateMeta( { campaign_name: value } ) }
			/>
			<TextControl
				label={ __( 'Subject', 'newspack-newsletters' ) }
				className="newspack-newsletters__subject-textcontrol"
				value={ title }
				disabled={ inFlight }
				onChange={ value => editPost( { title: value } ) }
			/>
			<TextareaControl
				label={ __( 'Preview text', 'newspack-newsletters' ) }
				className="newspack-newsletters__preview-textcontrol"
				value={ previewText }
				disabled={ inFlight }
				onChange={ value => updateMeta( { preview_text: value } ) }
			/>
			<ProviderSidebar
				inFlight={ inFlight }
				postId={ postId }
				updateMeta={ updateMeta }
			/>
			<hr />
			<Sender
				errors={ errors }
				senderEmail={ senderEmail }
				senderName={ senderName }
				updateMeta={ updateMeta }
			/>
		</div>
	);
};

export default compose( [
	withApiHandler(),
	withSelect( select => {
		const { getCurrentPostAttribute, getCurrentPostId, getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			title: getEditedPostAttribute( 'title' ),
			postId: getCurrentPostId(),
			senderEmail: meta.senderEmail,
			senderName: meta.senderName,
			campaignName: meta.campaign_name,
			previewText: meta.preview_text || '',
			status: getCurrentPostAttribute( 'status' ),
			stringifiedCampaignDefaults: meta.stringifiedCampaignDefaults || {},
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		const { createErrorNotice } = dispatch( 'core/notices' );
		return { editPost, createErrorNotice };
	} ),
] )( Sidebar );

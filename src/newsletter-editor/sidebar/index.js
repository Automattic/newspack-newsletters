/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { Button, Notice, Spinner, TextControl, TextareaControl } from '@wordpress/components';

/**
 * External dependencies
 */
import classnames from 'classnames';
import { once } from 'lodash';

/**
 * Internal dependencies
 */
import { hasValidEmail } from '../utils';
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
	sender,
	sendTo,
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
		if ( newsletterData?.fetched_sender ) {
			updateMeta( { sender: newsletterData.fetched_sender } );
		}
		if ( newsletterData?.fetched_list || newsletterData?.fetched_sublist ) {
			const newSendTo = {
				...sendTo,
				list: newsletterData?.fetched_list || sendTo.list,
				sublist: newsletterData?.fetched_sublist || sendTo.sublist
			};
			updateMeta( { send_to: newSendTo } );
		}
	}, [ newsletterData ] );

	useEffect( () => {
		const campaignDefaults = 'string' === typeof stringifiedCampaignDefaults ? JSON.parse( stringifiedCampaignDefaults ) : stringifiedCampaignDefaults;
		if ( campaignDefaults?.sender || campaignDefaults.send_to ) {
			if ( campaignDefaults?.sender ) {
				updateMeta( { sender: campaignDefaults.sender } );
			}
			if ( campaignDefaults?.send_to ) {
				updateMeta( { send_to: campaignDefaults.send_to } );
			}
		}
	}, [ stringifiedCampaignDefaults ] );

	const getCampaignName = () => {
		if ( typeof campaignName === 'string' ) {
			return campaignName;
		}
		return 'Newspack Newsletter (' + postId + ')';
	};

	const senderEmailClasses = classnames(
		'newspack-newsletters__email-textcontrol',
		errors.newspack_newsletters_unverified_sender_domain && 'newspack-newsletters__error'
	);

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

	// eslint-disable-next-line @wordpress/no-unused-vars-before-return
	const { ProviderSidebar } = getServiceProvider();
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
			/>
			<hr />
			<strong className="newspack-newsletters__label">
				{ __( 'From', 'newspack-newsletters' ) }
			</strong>
			{
				newsletterData?.fetched_sender && (
					<Notice status="success" isDismissible={ false }>
						{ __( 'Updated sender info fetched from ESP.', 'newspack-newsletters' ) }
					</Notice>
				)
			}
			<TextControl
				label={ __( 'Name', 'newspack-newsletters' ) }
				className="newspack-newsletters__name-textcontrol"
				value={ sender.name }
				disabled={ inFlight }
				onChange={ value => updateMeta( { sender: { ...sender, name: value } } ) }
				placeholder={ __( 'The campaign’s sender name.', 'newspack-newsletters' ) }
			/>
			<TextControl
				label={ __( 'Email', 'newspack-newsletters' ) }
				help={ sender.email && ! hasValidEmail( sender.email ) ? __( 'Please enter a valid email address.', 'newspack-newsletters' ) : null }
				className={ senderEmailClasses }
				value={ sender.email }
				type="email"
				disabled={ inFlight }
				onChange={ value => updateMeta( { sender: { ...sender, email: value } } ) }
				placeholder={ __( 'The campaign’s sender email.', 'newspack-newsletters' ) }
			/>
		</div>
	);
};

export default compose( [
	withApiHandler(),
	withSelect( select => {
		const { getEditedPostAttribute, getCurrentPostId } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			title: getEditedPostAttribute( 'title' ),
			postId: getCurrentPostId(),
			sender: meta.sender,
			sendTo: meta.send_to,
			campaignName: meta.campaign_name,
			previewText: meta.preview_text || '',
			stringifiedCampaignDefaults: meta.stringifiedCampaignDefaults || {},
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		const { createErrorNotice } = dispatch( 'core/notices' );
		return { editPost, createErrorNotice };
	} ),
] )( Sidebar );

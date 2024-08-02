/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { Fragment } from '@wordpress/element';
import { Button, TextControl, TextareaControl } from '@wordpress/components';

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
import './style.scss';

const Sidebar = ( {
	createErrorNotice,
	isConnected,
	oauthUrl,
	onAuthorize,
	inFlight,
	errors,
	editPost,
	title,
	senderName,
	senderEmail,
	campaignName,
	previewText,
	newsletterData,
	stringifiedLayoutDefaults,
	postId,
} ) => {
	const getCampaignName = () => {
		if ( typeof campaignName === 'string' ) {
			return campaignName;
		}
		return 'Newspack Newsletter (' + postId + ')';
	};

	const renderCampaignName = () => (
		<TextControl
			label={ __( 'Campaign Name', 'newspack-newsletters' ) }
			className="newspack-newsletters__campaign-name-textcontrol"
			value={ getCampaignName() }
			placeholder={ 'Newspack Newsletter (' + postId + ')' }
			disabled={ inFlight }
			onChange={ value => editPost( { meta: { campaign_name: value } } ) }
		/>
	);

	const renderSubject = () => (
		<TextControl
			label={ __( 'Subject', 'newspack-newsletters' ) }
			className="newspack-newsletters__subject-textcontrol"
			value={ title }
			disabled={ inFlight }
			onChange={ value => editPost( { title: value } ) }
		/>
	);

	const senderEmailClasses = classnames(
		'newspack-newsletters__email-textcontrol',
		errors.newspack_newsletters_unverified_sender_domain && 'newspack-newsletters__error'
	);

	const renderFrom = ( { handleSenderUpdate } ) => (
		<Fragment>
			<strong className="newspack-newsletters__label">
				{ __( 'From', 'newspack-newsletters' ) }
			</strong>
			<TextControl
				label={ __( 'Name', 'newspack-newsletters' ) }
				className="newspack-newsletters__name-textcontrol"
				value={ senderName }
				disabled={ inFlight }
				onChange={ value => {
					editPost( { meta: { senderName: value } } );
				} }
			/>
			<TextControl
				label={ __( 'Email', 'newspack-newsletters' ) }
				className={ senderEmailClasses }
				value={ senderEmail }
				type="email"
				disabled={ inFlight }
				onChange={ value => {
					editPost( { meta: { senderEmail: value } } );
				} }
			/>
			<Button
				isLink
				onClick={ () => handleSenderUpdate( { senderName, senderEmail } ) }
				disabled={ inFlight || ( senderEmail.length ? ! hasValidEmail( senderEmail ) : false ) }
			>
				{ __( 'Update Sender', 'newspack-newsletters' ) }
			</Button>
		</Fragment>
	);

	const renderPreviewText = () => (
		<TextareaControl
			label={ __( 'Preview text', 'newspack-newsletters' ) }
			className="newspack-newsletters__preview-textcontrol"
			value={ previewText }
			disabled={ inFlight }
			onChange={ value => editPost( { meta: { preview_text: value } } ) }
		/>
	);

	if ( false === isConnected ) {
		return (
			<Fragment>
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
			</Fragment>
		);
	}

	// eslint-disable-next-line @wordpress/no-unused-vars-before-return
	const { ProviderSidebar } = getServiceProvider();
	return (
		<Fragment>
			<ProviderSidebar
				postId={ postId }
				newsletterData={ newsletterData }
				stringifiedLayoutDefaults={ stringifiedLayoutDefaults }
				inFlight={ inFlight }
				editPost={ editPost }
				renderCampaignName={ renderCampaignName }
				renderSubject={ renderSubject }
				renderFrom={ renderFrom }
				renderPreviewText={ renderPreviewText }
				createErrorNotice={ createErrorNotice }
				updateMeta={ meta => editPost( { meta } ) }
			/>
		</Fragment>
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
			senderEmail: meta.senderEmail || '',
			senderName: meta.senderName || '',
			campaignName: meta.campaign_name,
			previewText: meta.preview_text || '',
			newsletterData: meta.newsletterData || {},
			stringifiedLayoutDefaults: meta.stringifiedLayoutDefaults || {},
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		const { createErrorNotice } = dispatch( 'core/notices' );
		return { editPost, createErrorNotice };
	} ),
] )( Sidebar );

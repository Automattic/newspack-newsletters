/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { Fragment } from '@wordpress/element';
import { Button, Spinner, TextControl, TextareaControl } from '@wordpress/components';

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
	createErrorNotice,
	isConnected,
	oauthUrl,
	onAuthorize,
	inFlight,
	errors,
	editPost,
	title,
	sender,
	campaignName,
	previewText,
	stringifiedLayoutDefaults,
	postId,
} ) => {
	const newsletterData = useNewsletterData();
	const campaign = newsletterData?.campaign;
	const updateMeta = ( meta ) => editPost( { meta } );
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

	const renderFrom = () => (
		<Fragment>
			<strong className="newspack-newsletters__label">
				{ __( 'From', 'newspack-newsletters' ) }
			</strong>
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
		</Fragment>
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
		<Fragment>
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
				postId={ postId }
				stringifiedLayoutDefaults={ stringifiedLayoutDefaults }
				inFlight={ inFlight }
				editPost={ editPost }
				renderFrom={ renderFrom }
				createErrorNotice={ createErrorNotice }
				updateMeta={ updateMeta }
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
			sender: meta.sender,
			campaignName: meta.campaign_name,
			previewText: meta.preview_text || '',
			stringifiedLayoutDefaults: meta.stringifiedLayoutDefaults || {},
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		const { createErrorNotice } = dispatch( 'core/notices' );
		return { editPost, createErrorNotice };
	} ),
] )( Sidebar );

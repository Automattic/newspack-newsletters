/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { Fragment } from '@wordpress/element';
import { Button, TextControl, TextareaControl, ToggleControl } from '@wordpress/components';

/**
 * External dependencies
 */
import classnames from 'classnames';
import { once } from 'lodash';

/**
 * Internal dependencies
 */
import { getEditPostPayload, hasValidEmail } from '../utils';
import { getServiceProvider } from '../../service-providers';
import withApiHandler from '../../components/with-api-handler';
import './style.scss';

const Sidebar = ( {
	isConnected,
	oauthUrl,
	onAuthorize,
	inFlight,
	errors,
	editPost,
	disableAds,
	senderName,
	senderEmail,
	previewText,
	newsletterData,
	apiFetchWithErrorHandling,
	postId,
} ) => {
	const apiFetch = config =>
		apiFetchWithErrorHandling( config ).then( result => {
			if ( typeof result === 'object' && result.campaign ) {
				editPost( getEditPostPayload( result ) );
			} else {
				return result;
			}
		} );

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
				inFlight={ inFlight }
				apiFetch={ apiFetch }
				renderFrom={ renderFrom }
				renderPreviewText={ renderPreviewText }
				updateMeta={ meta => editPost( { meta } ) }
			/>
			<hr />
			<ToggleControl
				label={ __( 'Disable ads for this newsletter?', 'newspack-newsletters' ) }
				className="newspack-newsletters__disable-ads"
				checked={ disableAds }
				disabled={ inFlight }
				help={ __(
					'If checked, no ads will be inserted into this newsletter’s content.',
					'newspack-newsletters'
				) }
				onChange={ value => editPost( { meta: { diable_ads: value } } ) }
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
			postId: getCurrentPostId(),
			senderEmail: meta.senderEmail || '',
			senderName: meta.senderName || '',
			previewText: meta.preview_text || '',
			newsletterData: meta.newsletterData || {},
			disableAds: meta.diable_ads,
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		return { editPost };
	} ),
] )( Sidebar );

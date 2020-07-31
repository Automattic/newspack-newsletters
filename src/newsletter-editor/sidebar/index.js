/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { useState, Fragment } from '@wordpress/element';
import { Button, TextControl, CheckboxControl } from '@wordpress/components';

/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * Internal dependencies
 */
import { getEditPostPayload, hasValidEmail } from '../utils';
import { getServiceProvider } from '../../service-providers';
import withApiHandler from '../../components/with-api-handler';
import './style.scss';

const { ProviderSidebar } = getServiceProvider();

const Sidebar = ( {
	inFlight,
	errors,
	editPost,
	title,
	disableAds,
	senderName,
	senderEmail,
	newsletterData,
	apiFetchWithErrorHandling,
	postId,
} ) => {
	const [ senderDirty, setSenderDirty ] = useState( false );

	const apiFetch = config =>
		apiFetchWithErrorHandling( config ).then( result => {
			editPost( getEditPostPayload( result ) );

			setSenderDirty( false );
		} );

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
			<strong>{ __( 'From', 'newspack-newsletters' ) }</strong>
			<TextControl
				label={ __( 'Name', 'newspack-newsletters' ) }
				className="newspack-newsletters__name-textcontrol"
				value={ senderName }
				disabled={ inFlight }
				onChange={ value => {
					editPost( { meta: { senderName: value } } );
					setSenderDirty( true );
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
					setSenderDirty( true );
				} }
			/>
			{ senderDirty && (
				<Button
					isLink
					onClick={ () => handleSenderUpdate( { senderName, senderEmail } ) }
					disabled={ inFlight || ( senderEmail.length ? ! hasValidEmail( senderEmail ) : false ) }
				>
					{ __( 'Update Sender', 'newspack-newsletters' ) }
				</Button>
			) }
		</Fragment>
	);

	const updateMetaValue = ( key, value ) => {
		editPost( { meta: { [ key ]: value } } );
		apiFetch( {
			data: { key, value },
			method: 'POST',
			path: `/newspack-newsletters/v1/post-meta/${ postId }`,
		} );
	};

	return (
		<Fragment>
			<ProviderSidebar
				postId={ postId }
				newsletterData={ newsletterData }
				inFlight={ inFlight }
				apiFetch={ apiFetch }
				renderSubject={ renderSubject }
				renderFrom={ renderFrom }
				updateMeta={ meta => editPost( { meta } ) }
			/>
			<CheckboxControl
				label={ __( 'Disable ads for this newsletter.', 'newspack-newsletters' ) }
				className="newspack-newsletters__disable-ads"
				checked={ disableAds }
				disabled={ inFlight }
				onChange={ value => updateMetaValue( 'diable_ads', value ) }
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
			newsletterData: meta.newsletterData || {},
			disableAds: meta.diable_ads,
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		return { editPost };
	} ),
] )( Sidebar );

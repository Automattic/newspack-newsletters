/**
 * External dependencies
 */
import { get, isEmpty } from 'lodash';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withDispatch, withSelect } from '@wordpress/data';
import { createPortal, useEffect, useState } from '@wordpress/element';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import { getServiceProvider } from '../../service-providers';
import withApiHandler from '../../components/with-api-handler';
import SendButton from '../../components/send-button';
import './style.scss';

const Editor = compose( [
	withApiHandler(),
	withSelect( select => {
		const {
			getCurrentPostId,
			getCurrentPostAttribute,
			getEditedPostAttribute,
			isPublishingPost,
			isSavingPost,
			isCleanNewPost,
		} = select( 'core/editor' );
		const { getActiveGeneralSidebarName } = select( 'core/edit-post' );
		const { getSettings } = select( 'core/block-editor' );
		const meta = getEditedPostAttribute( 'meta' );
		const status = getCurrentPostAttribute( 'status' );
		const sent = getCurrentPostAttribute( 'meta' ).newsletter_sent;
		const settings = getSettings();
		const experimentalSettingsColors = get( settings, [
			'__experimentalFeatures',
			'global',
			'color',
			'palette',
		] );
		const colors = settings.colors || experimentalSettingsColors || [];

		return {
			isCleanNewPost: isCleanNewPost(),
			postId: getCurrentPostId(),
			isReady: meta.newsletterValidationErrors
				? meta.newsletterValidationErrors.length === 0
				: false,
			activeSidebarName: getActiveGeneralSidebarName(),
			isPublishingOrSavingPost: isSavingPost() || isPublishingPost(),
			colorPalette: colors.reduce(
				( _colors, { slug, color } ) => ( { ..._colors, [ slug ]: color } ),
				{}
			),
			status,
			sent,
			isPublic: meta.is_public,
			html: meta[ window.newspack_email_editor_data.email_html_meta ],
			campaignName: meta.campaign_name,
			newsletterSendErrors: meta.newsletter_send_errors,
		};
	} ),
	withDispatch( dispatch => {
		const { lockPostAutosaving, lockPostSaving, unlockPostSaving, editPost } =
			dispatch( 'core/editor' );
		const { createNotice, removeNotice } = dispatch( 'core/notices' );
		return {
			lockPostAutosaving,
			lockPostSaving,
			unlockPostSaving,
			editPost,
			createNotice,
			removeNotice,
		};
	} ),
] )( props => {
	const [ publishEl ] = useState( document.createElement( 'div' ) );
	// Create alternate publish button
	useEffect( () => {
		const publishButton = document.getElementsByClassName(
			'editor-post-publish-button__button'
		)[ 0 ];
		publishButton.parentNode.insertBefore( publishEl, publishButton );
	}, [] );
	const { getFetchDataConfig } = getServiceProvider();

	// Set color palette option.
	useEffect( () => {
		if ( isEmpty( props.colorPalette ) ) {
			return;
		}
		props.apiFetchWithErrorHandling( {
			path: `/newspack-newsletters/v1/color-palette`,
			data: props.colorPalette,
			method: 'POST',
		} );
	}, [ JSON.stringify( props.colorPalette ) ] );

	// Fetch data from service provider.
	useEffect( () => {
		if ( ! props.isCleanNewPost && ! props.isPublishingOrSavingPost ) {
			// Exit if provider does not support fetching data.
			if ( ! getFetchDataConfig ) {
				return;
			}
			const params = getFetchDataConfig( { postId: props.postId } );
			// Exit if data config is example or does not provide path
			if ( ! params?.path || 0 === params.path.indexOf( '/newspack-newsletters/v1/example/' ) ) {
				return;
			}
			props.apiFetchWithErrorHandling( params ).then( result => {
				props.editPost( getEditPostPayload( result ) );
			} );
		}
	}, [ props.isPublishingOrSavingPost ] );

	// Lock or unlock post publishing.
	useEffect( () => {
		if ( props.isReady ) {
			props.unlockPostSaving( 'newspack-newsletters-post-lock' );
		} else {
			props.lockPostSaving( 'newspack-newsletters-post-lock' );
		}
	}, [ props.isReady ] );

	useEffect( () => {
		if ( props.sent ) {
			const sentDate = 0 < props.sent ? new Date( props.sent * 1000 ) : null;
			const dateTime = sentDate ? sentDate.toLocaleString() : '';

			// Lock autosaving after a newsletter is sent.
			props.lockPostAutosaving();

			// Show an editor notice if the newsletter has been sent.
			props.createNotice( 'success', props.successNote + dateTime, {
				isDismissible: false,
			} );

			// Remove error notice.
			props.removeNotice( 'newspack-newsletters-newsletter-send-error' );
		}
	}, [ props.sent ] );

	useEffect( () => {
		if ( ! props.sent && props.newsletterSendErrors ) {
			const message = sprintf(
				/* translators: %s: error message */
				__( 'Error sending newsletter: %s', 'newspack-newsletters' ),
				Object.values( props.newsletterSendErrors ).pop()
			);
			props.createNotice( 'error', message, {
				id: 'newspack-newsletters-newsletter-send-error',
				isDismissible: true,
			} );
		} else {
			props.removeNotice( 'newspack-newsletters-newsletter-send-error' );
		}
	}, [ props.newsletterSendError ] );

	// Notify if email content is larger than ~100kb.
	useEffect( () => {
		const noticeId = 'newspack-newsletters-email-content-too-large';
		const message = __(
			'Email content is too long and may get clipped by email clients.',
			'newspack-newsletters'
		);
		if ( props.html.length > 100000 ) {
			props.createNotice( 'warning', message, {
				id: noticeId,
				isDismissible: false,
			} );
		} else {
			props.removeNotice( noticeId );
		}
	}, [ props.html ] );

	useEffect( () => {
		// Hide post title if the newsletter is a not a public post.
		const editorTitleEl = document.querySelector( '.editor-post-title' );
		if ( editorTitleEl ) {
			editorTitleEl.classList[ props.isPublic ? 'remove' : 'add' ](
				'newspack-newsletters-post-title-hidden'
			);
		}
	}, [ props.isPublic ] );

	return createPortal( <SendButton />, publishEl );
} );

export default () => {
	registerPlugin( 'newspack-newsletters-edit', {
		render: Editor,
	} );
};

/**
 * External dependencies
 */
import { get, isEmpty } from 'lodash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withDispatch, withSelect } from '@wordpress/data';
import { createPortal, useEffect, useState } from '@wordpress/element';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import withApiHandler from '../../components/with-api-handler';
import SendButton from '../../components/send-button';
import './style.scss';
import { validateNewsletter } from '../utils';

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

		const newsletterValidationErrors = validateNewsletter( meta.newsletterData );

		return {
			isCleanNewPost: isCleanNewPost(),
			postId: getCurrentPostId(),
			isReady: newsletterValidationErrors.length === 0,
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
		}
	}, [ props.sent ] );

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

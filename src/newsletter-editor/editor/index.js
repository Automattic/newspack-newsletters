/* global newspack_email_editor_data */

/**
 * External dependencies
 */
import { get, isEmpty } from 'lodash';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
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
import { refreshEmailHtml, usePrevProp, validateNewsletter } from '../utils';

const Editor = compose( [
	withApiHandler(),
	withSelect( select => {
		const {
			didPostSaveRequestSucceed,
			getCurrentPostId,
			getCurrentPostAttribute,
			getCurrentPostType,
			getEditedPostAttribute,
			getEditedPostContent,
			isPublishingPost,
			isSavingPost,
			isPostAutosavingLocked,
			isAutosavingPost,
			isCleanNewPost,
			isCurrentPostPublished,
		} = select( 'core/editor' );
		const { getActiveGeneralSidebarName, getAllMetaBoxes } = select( 'core/edit-post' );
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
			postContent: getEditedPostContent(),
			postId: getCurrentPostId(),
			postTitle: getEditedPostAttribute( 'title' ),
			postType: getCurrentPostType(),
			isPublished: isCurrentPostPublished(),
			isReady: newsletterValidationErrors.length === 0,
			activeSidebarName: getActiveGeneralSidebarName(),
			didPostSaveRequestSucceed,
			html: meta[ newspack_email_editor_data.email_html_meta ],
			isSaving: isSavingPost(),
			isPublishing: isPublishingPost(),
			isAutosaving: isAutosavingPost(),
			isAutosaveLocked: isPostAutosavingLocked(),
			colorPalette: colors.reduce(
				( _colors, { slug, color } ) => ( { ..._colors, [ slug ]: color } ),
				{}
			),
			status,
			sent,
			isPublic: meta.is_public,
			campaignName: meta.campaign_name,
			newsletterSendErrors: meta.newsletter_send_errors,
			isCustomFieldsMetaBoxActive: getAllMetaBoxes().some( box => box.id === 'postcustom' ),
		};
	} ),
	withDispatch( dispatch => {
		const { lockPostAutosaving, lockPostSaving, unlockPostAutosaving, unlockPostSaving, editPost } =
			dispatch( 'core/editor' );
		const { createNotice, removeNotice } = dispatch( 'core/notices' );
		const { openModal } = dispatch( 'core/interface' );
		return {
			lockPostAutosaving,
			lockPostSaving,
			unlockPostAutosaving,
			unlockPostSaving,
			editPost,
			createNotice,
			removeNotice,
			openModal,
			updateMetaValue: ( key, value ) => editPost( { meta: { [ key ]: value } } ),
		};
	} ),
] )(
	( {
		apiFetchWithErrorHandling,
		colorPalette,
		createNotice,
		didPostSaveRequestSucceed,
		html,
		isCustomFieldsMetaBoxActive,
		isPublic,
		isReady,
		isSaving,
		isPublished,
		isPublishing,
		isAutosaveLocked,
		isAutosaving,
		lockPostAutosaving,
		lockPostSaving,
		newsletterSendErrors,
		openModal,
		removeNotice,
		unlockPostSaving,
		postContent,
		postId,
		postTitle,
		postType,
		sent,
		successNote,
		updateMetaValue,
	} ) => {
		const [ isRefreshingHTML, setIsRefreshingHTML ] = useState( false );
		const [ publishEl ] = useState( document.createElement( 'div' ) );

		useEffect( () => {
			// Create alternate publish button.
			const publishButton = document.getElementsByClassName(
				'editor-post-publish-button__button'
			)[ 0 ];
			publishButton.parentNode.insertBefore( publishEl, publishButton );

			// Show async error messages.
			if ( newspack_email_editor_data?.error_message ) {
				createNotice( 'error', newspack_email_editor_data.error_message, {
					id: 'newspack-newsletters-newsletter-async-error',
					isDismissible: true,
				} );
			}
		}, [] );

		// Disable autosave requests in the editor.
		useEffect( () => {
			if ( ! isAutosaveLocked ) {
				lockPostAutosaving();
			}
		}, [ isAutosaveLocked ] );

		// Set color palette option.
		useEffect( () => {
			if ( isEmpty( colorPalette ) ) {
				return;
			}
			apiFetchWithErrorHandling( {
				path: `/newspack-newsletters/v1/color-palette`,
				data: colorPalette,
				method: 'POST',
			} );
		}, [ JSON.stringify( colorPalette ) ] );

		// Lock or unlock post publishing.
		useEffect( () => {
			if ( isReady ) {
				unlockPostSaving( 'newspack-newsletters-post-lock' );
			} else {
				lockPostSaving( 'newspack-newsletters-post-lock' );
			}
		}, [ isReady ] );

		useEffect( () => {
			if ( sent ) {
				const sentDate = 0 < sent ? new Date( sent * 1000 ) : null;
				const dateTime = sentDate ? sentDate.toLocaleString() : '';

				// Lock autosaving after a newsletter is sent.
				lockPostAutosaving();

				// Show an editor notice if the newsletter has been sent.
				createNotice( 'success', successNote + dateTime, {
					isDismissible: false,
				} );

				// Remove error notice.
				removeNotice( 'newspack-newsletters-newsletter-send-error' );
			}
		}, [ sent ] );

		useEffect( () => {
			if ( isCustomFieldsMetaBoxActive ) {
				createNotice(
					'error',
					__(
						'"Custom Fields" meta box is active in the UI. This will prevent the newsletter editor from functioning correctly. Please disable this meta box in the "Panels" section of the Editor Preferences.',
						'newspack-newsletters'
					),
					{
						isDismissible: false,
						actions: [
							{
								label: __( 'Open Editor Preferences', 'newspack-newsletters' ),
								onClick: () => openModal( 'edit-post/preferences' ),
							},
						],
					}
				);
			}
		}, [ isCustomFieldsMetaBoxActive ] );

		useEffect( () => {
			if ( ! sent && newsletterSendErrors?.length ) {
				const message = sprintf(
					/* translators: %s: error message */
					__( 'Error sending newsletter: %s', 'newspack-newsletters' ),
					newsletterSendErrors[ newsletterSendErrors.length - 1 ].message
				);
				createNotice( 'error', message, {
					id: 'newspack-newsletters-newsletter-send-error',
					isDismissible: true,
				} );
			} else {
				removeNotice( 'newspack-newsletters-newsletter-send-error' );
			}
		}, [ newsletterSendErrors ] );

		// Notify if email content is larger than ~100kb.
		useEffect( () => {
			const noticeId = 'newspack-newsletters-email-content-too-large';
			const message = __(
				'Email content is too long and may get clipped by email clients.',
				'newspack-newsletters'
			);
			if ( html.length > 100000 ) {
				createNotice( 'warning', message, {
					id: noticeId,
					isDismissible: false,
				} );
			} else {
				removeNotice( noticeId );
			}
		}, [ html ] );

		useEffect( () => {
			// Hide post title if the newsletter is a not a public post.
			const editorTitleEl = document.querySelector( '.editor-post-title' );
			if ( editorTitleEl ) {
				editorTitleEl.classList[ isPublic ? 'remove' : 'add' ](
					'newspack-newsletters-post-title-hidden'
				);
			}
		}, [ isPublic ] );

		// After the post is successfully saved, refresh the email HTML.
		const wasSaving = usePrevProp( isSaving );
		useEffect( () => {
			if (
				wasSaving &&
				! isPublished &&
				! isSaving &&
				! isAutosaving &&
				! isPublishing &&
				! isRefreshingHTML &&
				didPostSaveRequestSucceed()
			) {
				setIsRefreshingHTML( true );
				lockPostSaving( 'newspack-newsletters-refresh-html' );
				refreshEmailHtml( postId, postTitle, postContent )
					.then( refreshedHtml => {
						updateMetaValue( newspack_email_editor_data.email_html_meta, refreshedHtml );
						apiFetchWithErrorHandling( {
							data: { meta: { [ newspack_email_editor_data.email_html_meta ]: refreshedHtml } },
							method: 'POST',
							path: `/wp/v2/${ postType }/${ postId }`,
						} );
					} )
					.finally( () => {
						unlockPostSaving( 'newspack-newsletters-refresh-html' );
						setIsRefreshingHTML( false );

						// Refresh newsletterData with latest data from the ESP.
						apiFetch( {
							path: `/newspack-newsletters/v1/${ window?.newspack_newsletters_data?.service_provider }/${ postId }/retrieve`,
						} )
							.then( response => {
								updateMetaValue( 'newsletterData', response );
							} )
							.catch( e => {
								createNotice(
									'error',
									e.message ||
										__( 'Error retrieving campaign information.', 'newspack-newsletters' ),
									{
										id: 'newspack-newsletters-newsletter-send-error',
										isDismissible: true,
									}
								);
							} );
					} );
			}
		}, [ isSaving, isAutosaving ] );

		return createPortal( <SendButton />, publishEl );
	}
);

export default () => {
	registerPlugin( 'newspack-newsletters-edit', {
		render: Editor,
	} );
};

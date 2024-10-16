/* global newspack_email_editor_data */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { refreshEmailHtml } from '../../newsletter-editor/utils';

/**
 * Internal dependencies
 */
import { fetchNewsletterData, fetchSyncErrors, updateNewsletterDataError } from '../../newsletter-editor/store';
import { getServiceProvider } from '../../service-providers';

/**
 * Custom hook for fetching the prior value of a prop.
 *
 * @param {*} value The prop to track.
 * @return {*} The prior value of the prop.
 */
const usePrevProp = value => {
	const ref = useRef();
	useEffect( () => {
		ref.current = value;
	}, [ value ] );
	return ref.current;
};

function MJML() {
	const [ isRefreshingHTML, setIsRefreshingHTML ] = useState( false );
	const {
		saveSucceeded,
		isPublishing,
		isAutosaving,
		isAutosaveLocked,
		isSaving,
		isSent,
		postContent,
		postId,
		postTitle,
		postType,
	} = useSelect( select => {
		const {
			didPostSaveRequestSucceed,
			getCurrentPostAttribute,
			getCurrentPostId,
			getCurrentPostType,
			getEditedPostAttribute,
			getEditedPostContent,
			isSavingPost,
			isPostAutosavingLocked,
			isAutosavingPost,
			isCurrentPostPublished,
		} = select( 'core/editor' );

		return {
			postContent: getEditedPostContent(),
			postId: getCurrentPostId(),
			postTitle: getEditedPostAttribute( 'title' ),
			postType: getCurrentPostType(),
			isPublished: isCurrentPostPublished(),
			saveSucceeded: didPostSaveRequestSucceed(),
			isSaving: isSavingPost(),
			isSent: getCurrentPostAttribute( 'meta' ).newsletter_sent,
			isAutosaving: isAutosavingPost(),
			isAutosaveLocked: isPostAutosavingLocked(),
		};
	} );

	const { lockPostAutosaving, lockPostSaving, unlockPostSaving, editPost } = useDispatch(
		'core/editor'
	);
	const updateMetaValue = ( key, value ) => editPost( { meta: { [ key ]: value } } );

	// Disable autosave requests in the editor.
	useEffect( () => {
		if ( ! isAutosaveLocked ) {
			lockPostAutosaving();
		}
	}, [ isAutosaveLocked ] );

	// After the post is successfully saved, refresh the email HTML.
	const wasSaving = usePrevProp( isSaving );
	const { name: serviceProviderName } = getServiceProvider();
	const { supported_esps: supportedESPs } = newspack_email_editor_data || [];
	const isSupportedESP = serviceProviderName && 'manual' !== serviceProviderName && supportedESPs?.includes( serviceProviderName );

	useEffect( () => {
		if (
			wasSaving &&
			! isSaving &&
			! isAutosaving &&
			! isPublishing &&
			! isRefreshingHTML &&
			! isSent &&
			saveSucceeded
		) {
			setIsRefreshingHTML( true );
			lockPostSaving( 'newspack-newsletters-refresh-html' );
			refreshEmailHtml( postId, postTitle, postContent )
				.then( refreshedHtml => {
					updateMetaValue( newspack_email_editor_data.email_html_meta, refreshedHtml );
					return apiFetch( {
						data: { meta: { [ newspack_email_editor_data.email_html_meta ]: refreshedHtml } },
						method: 'POST',
						path: `/wp/v2/${ postType }/${ postId }`,
					} );
				} ).then( () => {
					// Rehydrate ESP newsletter data after completing sync.
					if ( isSupportedESP ) {
						return fetchNewsletterData( postId );
					}
					return true;
				} ).then ( () => {
					// Check for sync errors after refreshing the HTML.
					if ( isSupportedESP ) {
						return fetchSyncErrors( postId );
					}
					return true;
				} )
				.catch( e => {
					updateNewsletterDataError( e );
				} )
				.finally( () => {
					unlockPostSaving( 'newspack-newsletters-refresh-html' );
					setIsRefreshingHTML( false );
				} );
		}
	}, [ isSaving, isAutosaving ] );
}

export default MJML;

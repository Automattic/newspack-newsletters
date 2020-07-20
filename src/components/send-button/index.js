/**
 * WordPress dependencies
 */
import { withDispatch, withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Button, Modal, Notice } from '@wordpress/components';
import { Fragment, useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf, _n } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * Internal dependencies
 */
import { getServiceProvider } from '../../service-providers';
import './style.scss';
import { NEWSLETTER_AD_CPT_SLUG, NEWSLETTER_CPT_SLUG } from '../../utils/consts';
import { isAdActive } from '../../ads-admin/utils';

const { renderPreSendInfo } = getServiceProvider();

export default compose( [
	withDispatch( dispatch => {
		const { editPost, savePost } = dispatch( 'core/editor' );
		return { editPost, savePost };
	} ),
	withSelect( ( select, { forceIsSaving, forceIsDirty } ) => {
		const {
			getCurrentPost,
			getEditedPostAttribute,
			getEditedPostVisibility,
			isEditedPostPublishable,
			isEditedPostSaveable,
			isSavingPost,
			isEditedPostBeingScheduled,
		} = select( 'core/editor' );
		const { newsletterData = {}, newsletterValidationErrors, is_public } = getEditedPostAttribute(
			'meta'
		);
		return {
			isPublishable: forceIsDirty || isEditedPostPublishable(),
			isSaveable: isEditedPostSaveable(),
			isSaving: forceIsSaving || isSavingPost(),
			validationErrors: newsletterValidationErrors,
			status: getEditedPostAttribute( 'status' ),
			isEditedPostBeingScheduled: isEditedPostBeingScheduled(),
			hasPublishAction: get( getCurrentPost(), [ '_links', 'wp:action-publish' ], false ),
			visibility: getEditedPostVisibility(),
			newsletterData,
			isPublic: is_public,
		};
	} ),
] )(
	( {
		editPost,
		isPublishable,
		isSaveable,
		isSaving,
		savePost,
		status,
		validationErrors = [],
		isEditedPostBeingScheduled,
		hasPublishAction,
		visibility,
		newsletterData,
		isPublic,
	} ) => {
		// State to handle post-publish changes to Public setting.
		const [ isDirty, setIsDirty ] = useState( false );
		const isPublicRef = useRef();
		const prevIsPublic = isPublicRef.current;

		useEffect( () => {
			isPublicRef.current = isPublic;
		} );

		// If changing the Public setting post-sending.
		useEffect(() => {
			if ( undefined !== prevIsPublic && isPublic !== prevIsPublic && 'publish' === status ) {
				setIsDirty( true );
			}
		}, [ isPublic ]);

		const isButtonEnabled =
			( isPublishable || isEditedPostBeingScheduled ) &&
			isSaveable &&
			'publish' !== status &&
			! isSaving;
		let label;
		if ( 'publish' === status ) {
			if ( isSaving ) label = __( 'Sending', 'newspack-newsletters' );
			else {
				label = isPublic
					? __( 'Sent and Published', 'newspack-newsletters' )
					: __( 'Sent', 'newspack-newsletters' );
			}
		} else if ( 'future' === status ) {
			// Scheduled to be sent
			label = __( 'Scheduled', 'newspack-newsletters' );
		} else if ( isEditedPostBeingScheduled ) {
			label = __( 'Schedule sending', 'newspack-newsletters' );
		} else {
			label = isPublic
				? __( 'Send and Publish', 'newspack-newsletters' )
				: __( 'Send', 'newspack-newsletters' );
		}

		let publishStatus;
		if ( ! hasPublishAction ) {
			publishStatus = 'pending';
		} else if ( visibility === 'private' ) {
			publishStatus = 'private';
		} else if ( isEditedPostBeingScheduled ) {
			publishStatus = 'future';
		} else {
			publishStatus = 'publish';
		}

		const [ adsWarning, setAdsWarning ] = useState();
		useEffect(() => {
			apiFetch( {
				path: `/wp/v2/${ NEWSLETTER_AD_CPT_SLUG }`,
			} ).then( response => {
				const activeAds = response.filter( isAdActive );
				if ( activeAds.length ) {
					setAdsWarning(
						sprintf(
							_n(
								'There is %d active ad.',
								'There are %d active ads.',
								activeAds.length,
								'newspack-newsletters'
							),
							activeAds.length
						)
					);
				}
			} );
		}, []);

		const triggerCampaignSend = () => {
			editPost( { status: publishStatus } );
			savePost();
		};

		const [ modalVisible, setModalVisible ] = useState( false );

		// If we've changed the Public setting post-publish, allow the user to just save the post.
		if ( isDirty && 'publish' === publishStatus ) {
			return (
				<Button
					className="editor-post-publish-button"
					isBusy={ isSaving }
					isPrimary
					isLarge
					disabled={ isSaving }
					onClick={ async () => {
						await savePost();
						setIsDirty( false );
					} }
				>
					{ isSaving
						? __( 'Updating...', 'newspack-newsletters' )
						: __( 'Update', 'newspack-newsletters' ) }
				</Button>
			);
		}

		return (
			<Fragment>
				<Button
					className="editor-post-publish-button"
					isBusy={ isSaving && 'publish' === status }
					isPrimary
					isLarge
					onClick={ () => setModalVisible( true ) }
					disabled={ ! isButtonEnabled }
				>
					{ label }
				</Button>
				{ modalVisible && (
					<Modal
						className="newspack-newsletters__modal"
						title={ __( 'Send your newsletter?', 'newspack-newsletters' ) }
						onRequestClose={ () => setModalVisible( false ) }
					>
						{ adsWarning ? (
							<Notice isDismissible={ false }>
								{ adsWarning }{' '}
								<a
									href={ `/wp-admin/edit.php?post_type=${ NEWSLETTER_CPT_SLUG }&page=newspack-newsletters-ads-admin` }
								>
									{ __( 'Manage ads', 'newspack-newsletters' ) }
								</a>
							</Notice>
						) : null }
						{ renderPreSendInfo( newsletterData ) }
						{ validationErrors.length ? (
							<Notice status="error" isDismissible={ false }>
								{ __(
									'The following errors prevent the newsletter from being sent:',
									'newspack-newsletters'
								) }
								<ul>
									{ validationErrors.map( ( error, i ) => (
										<li key={ i }>{ error }</li>
									) ) }
								</ul>
							</Notice>
						) : null }
						<Button
							isPrimary
							disabled={ validationErrors.length > 0 }
							onClick={ () => {
								triggerCampaignSend();
								setModalVisible( false );
							} }
						>
							{ __( 'Send', 'newspack-newsletters' ) }
						</Button>
						<Button isSecondary onClick={ () => setModalVisible( false ) }>
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
					</Modal>
				) }
			</Fragment>
		);
	}
);

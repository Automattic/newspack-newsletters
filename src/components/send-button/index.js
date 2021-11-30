/**
 * WordPress dependencies
 */
import { withDispatch, withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Button, Modal, Notice } from '@wordpress/components';
import { Fragment, useEffect, useState } from '@wordpress/element';
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

export default compose( [
	withDispatch( dispatch => {
		const { editPost, savePost } = dispatch( 'core/editor' );
		return { editPost, savePost };
	} ),
	withSelect( ( select, { forceIsDirty } ) => {
		const {
			getCurrentPost,
			getEditedPostAttribute,
			getEditedPostVisibility,
			isEditedPostPublishable,
			isEditedPostSaveable,
			isSavingPost,
			isEditedPostBeingScheduled,
			isCurrentPostPublished,
		} = select( 'core/editor' );
		return {
			isPublishable: forceIsDirty || isEditedPostPublishable(),
			isSaveable: isEditedPostSaveable(),
			status: getEditedPostAttribute( 'status' ),
			isSaving: isSavingPost(),
			isEditedPostBeingScheduled: isEditedPostBeingScheduled(),
			hasPublishAction: get( getCurrentPost(), [ '_links', 'wp:action-publish' ], false ),
			visibility: getEditedPostVisibility(),
			meta: getEditedPostAttribute( 'meta' ),
			isPublished: isCurrentPostPublished(),
		};
	} ),
] )(
	( {
		editPost,
		savePost,
		isPublishable,
		isSaveable,
		isSaving,
		status,
		isEditedPostBeingScheduled,
		hasPublishAction,
		visibility,
		meta,
		isPublished,
	} ) => {
		const { newsletterData = {}, newsletterValidationErrors = [], is_public } = meta;

		const {
			name: serviceProviderName,
			renderPreSendInfo,
			renderPostUpdateInfo,
		} = getServiceProvider();

		const isButtonEnabled =
			( isPublishable || isEditedPostBeingScheduled ) &&
			isSaveable &&
			! isPublished &&
			! isSaving &&
			( newsletterData.campaign || 'manual' === serviceProviderName ) &&
			0 === newsletterValidationErrors.length;
		let label;
		if ( isPublished ) {
			if ( isSaving ) label = __( 'Sending', 'newspack-newsletters' );
			else {
				label = is_public
					? __( 'Sent and Published', 'newspack-newsletters' )
					: __( 'Sent', 'newspack-newsletters' );
			}
		} else if ( 'future' === status ) {
			// Scheduled to be sent
			label = __( 'Scheduled', 'newspack-newsletters' );
		} else if ( isEditedPostBeingScheduled ) {
			label = __( 'Schedule sending', 'newspack-newsletters' );
		} else {
			label = is_public
				? __( 'Send and Publish', 'newspack-newsletters' )
				: __( 'Send', 'newspack-newsletters' );
		}

		let updateLabel;
		if ( isSaving ) {
			updateLabel = __( 'Updating...', 'newspack-newsletters' );
		} else if ( 'manual' === serviceProviderName ) {
			updateLabel = __( 'Update and copy HTML', 'newspack-newsletters' );
		} else {
			updateLabel = __( 'Update', 'newspack-newsletters' );
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

		let modalSubmitLabel;
		if ( 'manual' === serviceProviderName ) {
			modalSubmitLabel = is_public
				? __( 'Mark as sent and publish', 'newspack-newsletters' )
				: __( 'Mark as sent', 'newspack-newsletters' );
		} else {
			modalSubmitLabel = __( 'Send', 'newspack-newsletters' );
		}

		const [ adsWarning, setAdsWarning ] = useState();
		useEffect( () => {
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
		}, [] );

		const triggerCampaignSend = () => {
			editPost( { status: publishStatus } );
			savePost();
		};

		const [ modalVisible, setModalVisible ] = useState( false );

		// For sent newsletters, display the generic button text.
		if ( isPublished ) {
			return (
				<Fragment>
					<Button
						className="editor-post-publish-button"
						isBusy={ isSaving }
						isPrimary
						disabled={ isSaving }
						onClick={ async () => {
							await savePost();
							if ( renderPostUpdateInfo ) setModalVisible( true );
						} }
					>
						{ updateLabel }
					</Button>
					{ modalVisible && renderPostUpdateInfo && (
						<Modal
							className="newspack-newsletters__modal"
							title={ __( 'Newsletter HTML', 'newspack-newsletters' ) }
							onRequestClose={ () => setModalVisible( false ) }
						>
							{ adsWarning ? (
								<Notice isDismissible={ false }>
									{ adsWarning }{ ' ' }
									<a
										href={ `/wp-admin/edit.php?post_type=${ NEWSLETTER_CPT_SLUG }&page=newspack-newsletters-ads-admin` }
									>
										{ __( 'Manage ads', 'newspack-newsletters' ) }
									</a>
								</Notice>
							) : null }
							{ renderPostUpdateInfo( newsletterData ) }
						</Modal>
					) }
				</Fragment>
			);
		}

		return (
			<Fragment>
				<Button
					className="editor-post-publish-button"
					isBusy={ isSaving && 'publish' === status }
					isPrimary
					onClick={ async () => {
						await savePost();
						setModalVisible( true );
					} }
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
								{ adsWarning }{ ' ' }
								<a
									href={ `/wp-admin/edit.php?post_type=${ NEWSLETTER_CPT_SLUG }&page=newspack-newsletters-ads-admin` }
								>
									{ __( 'Manage ads', 'newspack-newsletters' ) }
								</a>
							</Notice>
						) : null }
						{ renderPreSendInfo( newsletterData ) }
						{ newsletterValidationErrors.length ? (
							<Notice status="error" isDismissible={ false }>
								{ __(
									'The following errors prevent the newsletter from being sent:',
									'newspack-newsletters'
								) }
								<ul>
									{ newsletterValidationErrors.map( ( error, i ) => (
										<li key={ i }>{ error }</li>
									) ) }
								</ul>
							</Notice>
						) : null }
						<div className="modal-buttons">
							<Button isSecondary onClick={ () => setModalVisible( false ) }>
								{ __( 'Cancel', 'newspack-newsletters' ) }
							</Button>
							<Button
								isPrimary
								disabled={ newsletterValidationErrors.length > 0 }
								onClick={ () => {
									triggerCampaignSend();
									setModalVisible( false );
								} }
							>
								{ modalSubmitLabel }
							</Button>
						</div>
					</Modal>
				) }
			</Fragment>
		);
	}
);

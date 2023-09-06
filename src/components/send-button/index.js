/**
 * WordPress dependencies
 */
import { withDispatch, withSelect, useSelect, useDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Button, Modal, Spinner } from '@wordpress/components';
import { Fragment, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Testing from '../../newsletter-editor/testing';
import { DisableAutoAds } from '../../ads/newsletter-editor';

/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * Internal dependencies
 */
import { getServiceProvider } from '../../service-providers';
import './style.scss';

function PreviewHTML() {
	const { meta, isSavingPost, isAutoSavingPost } = useSelect( select => {
		return {
			meta: select( 'core/editor' ).getCurrentPostAttribute( 'meta' ),
			isSavingPost: select( 'core/editor' ).isSavingPost(),
			isAutoSavingPost: select( 'core/editor' ).isAutosavingPost(),
		};
	} );
	const showSpinner = isSavingPost && ! isAutoSavingPost;
	return (
		<div className="newsletter-preview-html">
			{ showSpinner && (
				<div className="newsletter-preview-html__spinner">
					<Spinner />
				</div>
			) }
			{ ! showSpinner ? (
				<iframe
					title={ __( 'Preview email', 'newspack-newsletters' ) }
					srcDoc={ meta.newspack_email_html }
					className="newsletter-preview-html__iframe"
				/>
			) : null }
		</div>
	);
}

function PreviewHTMLButton() {
	const { isSavingPost } = useSelect( select => {
		return {
			isSavingPost: select( 'core/editor' ).isSavingPost(),
		};
	} );
	const { savePost } = useDispatch( 'core/editor' );
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	return (
		<Fragment>
			<Button
				className="newsletter-preview-html-button"
				variant="secondary"
				disabled={ isSavingPost }
				onClick={ async () => {
					savePost();
					setIsModalOpen( true );
				} }
			>
				{ __( 'Preview email', 'newspack-newsletters' ) }
			</Button>
			{ isModalOpen && (
				<Modal
					title={ __( 'Preview email', 'newspack-newsletters' ) }
					onRequestClose={ () => setIsModalOpen( false ) }
					className="newsletter-preview-html-modal"
					overlayClassName="newsletter-preview-html-modal__overlay"
					shouldCloseOnClickOutside={ false }
					isFullScreen
				>
					<PreviewHTML />
				</Modal>
			) }
		</Fragment>
	);
}

export default compose( [
	withDispatch( dispatch => {
		const { editPost, savePost } = dispatch( 'core/editor' );
		return { editPost, savePost };
	} ),
	withSelect( ( select, { forceIsDirty } ) => {
		const {
			getCurrentPost,
			getCurrentPostAttribute,
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
			sent: getCurrentPostAttribute( 'meta' ).newsletter_sent,
			isPublished: isCurrentPostPublished(),
			postDate: getEditedPostAttribute( 'date' ),
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
		sent,
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
			updateLabel = __( 'Updating…', 'newspack-newsletters' );
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

		const [ testEmail, setTestEmail ] = useState(
			window?.newspack_newsletters_data?.user_test_emails?.join( ',' ) || ''
		);

		let modalSubmitLabel;
		if ( 'manual' === serviceProviderName ) {
			modalSubmitLabel = is_public
				? __( 'Mark as sent and publish', 'newspack-newsletters' )
				: __( 'Mark as sent', 'newspack-newsletters' );
		} else {
			modalSubmitLabel = label;
		}

		const triggerCampaignSend = () => {
			editPost( { status: publishStatus } );
			savePost();
		};

		const [ modalVisible, setModalVisible ] = useState( false );

		// For sent newsletters, display the generic button text.
		if ( isPublished || sent ) {
			return (
				<Fragment>
					<PreviewHTMLButton />
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
							shouldCloseOnClickOutside={ false }
							isFullScreen
						>
							<div className="newspack-newsletters__modal__container">
								<div className="newspack-newsletters__modal__preview">
									<PreviewHTML />
								</div>
								<div className="newspack-newsletters__modal__content">
									<DisableAutoAds saveOnToggle />
									<hr />
									{ 'manual' !== serviceProviderName && (
										<Testing
											testEmail={ testEmail }
											onChangeEmail={ setTestEmail }
											disabled={ isSaving }
											inlineNotifications
										/>
									) }
									<hr />
									{ renderPostUpdateInfo( newsletterData ) }
								</div>
							</div>
						</Modal>
					) }
				</Fragment>
			);
		}

		return (
			<Fragment>
				<PreviewHTMLButton />
				<Button
					className="editor-post-publish-button"
					isBusy={ isSaving && 'publish' === status }
					variant="primary"
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
						shouldCloseOnClickOutside={ false }
						isFullScreen
					>
						<div className="newspack-newsletters__modal__container">
							<div className="newspack-newsletters__modal__preview">
								<PreviewHTML />
							</div>
							<div className="newspack-newsletters__modal__content">
								<DisableAutoAds saveOnToggle />
								<hr />
								{ 'manual' !== serviceProviderName && (
									<Testing
										testEmail={ testEmail }
										onChangeEmail={ setTestEmail }
										disabled={ isSaving }
										inlineNotifications
									/>
								) }
								<div className="newspack-newsletters__modal__spacer" />
								{ renderPreSendInfo( newsletterData ) }
								<div className="modal-buttons">
									<Button
										variant="secondary"
										onClick={ () => setModalVisible( false ) }
										disabled={ isSaving }
									>
										{ __( 'Cancel', 'newspack-newsletters' ) }
									</Button>
									<Button
										variant="primary"
										disabled={ newsletterValidationErrors.length > 0 || isSaving }
										onClick={ () => {
											triggerCampaignSend();
											setModalVisible( false );
										} }
									>
										{ modalSubmitLabel }
									</Button>
								</div>
							</div>
						</div>
					</Modal>
				) }
			</Fragment>
		);
	}
);

/**
 * WordPress dependencies
 */
import { withDispatch, withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Button, Modal } from '@wordpress/components';
import { Fragment, useState } from '@wordpress/element';
import { __, sprintf, _n } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { get, find } from 'lodash';

/**
 * Internal dependencies
 */
import { getListInterestsSettings } from '../../service-providers/mailchimp/utils';

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
		const { newsletterData = {}, newsletterValidationErrors } = getEditedPostAttribute( 'meta' );
		let listData;
		if ( newsletterData.campaign && newsletterData.lists ) {
			const list = find( newsletterData.lists.lists, [
				'id',
				newsletterData.campaign.recipients.list_id,
			] );
			const interestSettings = getListInterestsSettings( newsletterData );

			if ( list ) {
				listData = { name: list.name, subscribers: parseInt( list.stats.member_count ) };
				if ( interestSettings && interestSettings.setInterest ) {
					listData.groupName = interestSettings.setInterest.rawInterest.name;
					listData.subscribers = parseInt(
						interestSettings.setInterest.rawInterest.subscriber_count
					);
				}
			}
		}
		return {
			isPublishable: forceIsDirty || isEditedPostPublishable(),
			isSaveable: isEditedPostSaveable(),
			isSaving: forceIsSaving || isSavingPost(),
			validationErrors: newsletterValidationErrors,
			status: getEditedPostAttribute( 'status' ),
			isEditedPostBeingScheduled: isEditedPostBeingScheduled(),
			hasPublishAction: get( getCurrentPost(), [ '_links', 'wp:action-publish' ], false ),
			visibility: getEditedPostVisibility(),
			listData,
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
		validationErrors,
		isEditedPostBeingScheduled,
		hasPublishAction,
		visibility,
		listData,
	} ) => {
		const isButtonEnabled =
			listData &&
			( isPublishable || isEditedPostBeingScheduled ) &&
			isSaveable &&
			validationErrors &&
			! validationErrors.length &&
			'publish' !== status;
		let label;
		if ( 'publish' === status ) {
			label = isSaving
				? __( 'Sending', 'newspack-newsletters' )
				: __( 'Sent', 'newspack-newsletters' );
		} else if ( 'future' === status ) {
			// Scheduled to be sent
			label = __( 'Scheduled', 'newspack-newsletters' );
		} else if ( isEditedPostBeingScheduled ) {
			label = __( 'Schedule sending', 'newspack-newsletters' );
		} else {
			label = __( 'Send', 'newspack-newsletters' );
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

		const triggerCampaignSend = () => {
			editPost( { status: publishStatus } );
			savePost();
		};

		const [ modalVisible, setModalVisible ] = useState( false );

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
						<p>
							{ __( "You're about to send a newsletter to:", 'newspack-newsletters' ) }
							<br />
							<strong>{ listData.name }</strong>
							<br />
							{ listData.groupName && (
								<Fragment>
									{ __( 'Group:', 'newspack-newsletters' ) } <strong>{ listData.groupName }</strong>
									<br />
								</Fragment>
							) }
							<strong>
								{ sprintf(
									_n(
										'%d subscriber',
										'%d subscribers',
										listData.subscribers,
										'newspack-newsletters'
									),
									listData.subscribers
								) }
							</strong>
						</p>
						<Button
							isPrimary
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

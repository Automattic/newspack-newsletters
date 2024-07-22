/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ExternalLink, Spinner, Notice } from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import SendTo from '../../newsletter-editor/sidebar/send-to';

const getSendToLabel = item => {
	const isList = item.hasOwnProperty( 'list_id' );
	return sprintf(
		// Translators: %1$s is the type of list or segment, %2$s is the name of the list or segment, %3$s is the number of contacts in the list.
		__( '[%1$s] %2$s %3$s', 'newspack-newsletters' ),
		isList ? __( 'LIST', 'newspack-newsletters' ) : __( 'SEGMENT', 'newspack-newsletters' ),
		item.name,
		item.hasOwnProperty( 'membership_count' )
			? sprintf(
					// Translators: %d is the number of contacts in the list or segment.
					_n( '(%d contact)', '(%d contacts)', item.membership_count, 'newspack-newsletters' ),
					item.membership_count
			  )
			: ''
	).trim();
};

const getSendToLink = item => {
	const isList = item.hasOwnProperty( 'list_id' );

	return (
		<p>
			<ExternalLink
				href={
					isList
						? `https://app.constantcontact.com/pages/contacts/ui#contacts/${ item.list_id }`
						: `https://app.constantcontact.com/pages/contacts/ui#segments/${ item.segment_id }/preview`
				}
			>
				{ __( 'View in Constant Contact', 'newspack-newsletters' ) }
			</ExternalLink>
		</p>
	);
};

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../../newsletter-editor/utils';
import './style.scss';

const ProviderSidebarComponent = ( {
	editPost,
	inFlight,
	renderCampaignName,
	renderSubject,
	renderFrom,
	renderPreviewText,
	newsletterData,
	postId,
	updateMetaValue,
	status,
} ) => {
	const { campaign, lists = [], segments = [] } = newsletterData;
	const availableLists = [ ...lists, ...segments ].map( item => {
		item.value = item.list_id || item.segment_id;
		item.label = getSendToLabel( item );
		return item;
	} );

	const selectedList =
		availableLists.find( list => {
			if ( campaign?.activity?.contact_list_ids?.length ) {
				return list.list_id === campaign.activity.contact_list_ids[ 0 ];
			}
			if ( campaign?.activity?.segment_ids?.length ) {
				return list.segment_id === campaign.activity.segment_ids[ 0 ];
			}
			return false;
		} ) || null;

	const setSender = ( { senderName, senderEmail } ) =>
		apiFetch( {
			path: `/newspack-newsletters/v1/constant_contact/${ postId }/sender`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		} );

	const updateCampaign = config => {
		return apiFetch( config ).then( result => {
			if ( typeof result === 'object' && result.campaign ) {
				editPost( getEditPostPayload( result ) );
			}
			return result;
		} );
	};

	const setList = ( listId, value ) => {
		return updateCampaign( {
			path: `/newspack-newsletters/v1/constant_contact/${ postId }/list/${ listId }`,
			method: value ? 'PUT' : 'DELETE',
		} );
	};

	const setSegment = segmentId => {
		return updateCampaign( {
			path: `/newspack-newsletters/v1/constant_contact/${ postId }/segment/${ segmentId || '' }`,
			method: segmentId ? 'PUT' : 'DELETE',
		} );
	};

	const onChangeSendTo = labels => {
		const selectedLabel = labels[ 0 ];
		const selectedItem = availableLists.find( item => item.label === selectedLabel );

		// If the selected item is already selected in the campaign, no need to update.
		if ( selectedItem.value === selectedList?.value ) {
			return;
		}

		return selectedItem.hasOwnProperty( 'list_id' )
			? setList( selectedItem.value, true )
			: setSegment( selectedItem.value );
	};

	const resetSendTo = () => {
		return selectedList && selectedList.hasOwnProperty( 'list_id' )
			? setList( selectedList.list_id, false )
			: setSegment( false );
	};

	useEffect( () => {
		if ( campaign ) {
			updateMetaValue( {
				senderName: campaign.activity.from_name,
				senderEmail: campaign.activity.from_email,
			} );
		}
	}, [ campaign ] );

	if ( ! campaign ) {
		return (
			<div className="newspack-newsletters__loading-data">
				{ __( 'Retrieving Constant Contact data…', 'newspack-newsletters' ) }
				<Spinner />
			</div>
		);
	}

	if (
		! inFlight &&
		( 'DRAFT' !== campaign?.current_status || 'publish' === status || 'private' === status )
	) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
		);
	}

	return (
		<>
			{ renderCampaignName() }
			{ renderSubject() }
			{ renderPreviewText() }
			<hr />
			{ renderFrom( { handleSenderUpdate: setSender } ) }
			<hr />
			<strong className="newspack-newsletters__label">
				{ __( 'Send to', 'newspack-newsletters' ) }
			</strong>
			<SendTo
				availableLists={ availableLists }
				onChange={ onChangeSendTo }
				formLabel={ __( 'Select a list or segment', 'newspack' ) }
				getLabel={ getSendToLabel }
				getLink={ getSendToLink }
				placeholder={ __( 'Type a list or segment name to search.', 'newspack' ) }
				reset={ resetSendTo }
				selectedList={ selectedList }
			/>
		</>
	);
};

const mapStateToProps = select => {
	const { getCurrentPostAttribute, getEditedPostAttribute } = select( 'core/editor' );
	return {
		meta: getEditedPostAttribute( 'meta' ),
		status: getCurrentPostAttribute( 'status' ),
	};
};

export const ProviderSidebar = compose( [ withSelect( mapStateToProps ) ] )(
	ProviderSidebarComponent
);

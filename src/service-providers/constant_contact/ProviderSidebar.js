/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Spinner, Notice } from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import SendTo from '../../newsletter-editor/sidebar/send-to';
import { getEditPostPayload, getSuggestionLabel } from '../../newsletter-editor/utils';
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
	updateMeta,
	status,
} ) => {
	const { campaign, lists = [], segments = [] } = newsletterData;

	// Standardize data schema. We'll eventually move this standardization to the provider API handlers instead.
	const availableItems = [ ...lists, ...segments ].map( item => {
		const isList = item.hasOwnProperty( 'list_id' );
		const count = item.membership_count || null;
		const formattedItem = {
			...item,
			editLink: isList
				? `https://app.constantcontact.com/pages/contacts/ui#contacts/${ item.list_id }`
				: `https://app.constantcontact.com/pages/contacts/ui#segments/${ item.segment_id }/preview`,
			name: item.name || item.title,
			typeLabel: isList
				? __( 'List', 'newspack-newsletters' )
				: __( 'Segment', 'newspack-newsletters' ),
			type: isList ? 'list' : 'segment',
			value: item.list_id || item.segment_id,
		};

		if ( null !== count ) {
			formattedItem.count = parseInt( count );
		}
		formattedItem.label = getSuggestionLabel( formattedItem );

		return formattedItem;
	} );

	const selected =
		availableItems.find( list => {
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

	const onChangeSendTo = async labels => {
		const selectedLabel = labels[ 0 ];
		const selectedItem = availableItems.find( item => item.label === selectedLabel );

		// If the selected item is already selected in the campaign, no need to update.
		if ( ! selectedItem || selected?.value === selectedItem?.value ) {
			return;
		}

		return selectedItem.hasOwnProperty( 'list_id' )
			? setList( selectedItem.value, true )
			: setSegment( selectedItem.value );
	};

	const resetSendTo = () => {
		return selected && selected.hasOwnProperty( 'list_id' )
			? setList( selected.list_id, false )
			: setSegment( false );
	};

	useEffect( () => {
		if ( campaign?.activity?.from_name && campaign?.activity?.from_email ) {
			updateMeta( {
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

	const renderSelectedSummary = () => {
		if ( ! selected ) {
			return null;
		}

		const summary = ! selected.hasOwnProperty( 'count' )
			? sprintf(
					// Translators: A summary of which list or segment the campaign is set to send to, and the total number of contacts, if available.
					'This newsletter will be sent to <strong>all contacts</strong> in the <strong>%1$s</strong> %2$s.',
					selected.name,
					selected.typeLabel.toLowerCase()
			  )
			: sprintf(
					// Translators: A summary of which list the campaign is set to send to, and the total number of contacts, if available.
					_n(
						'This newsletter will be sent to <strong>%1$s contact</strong> in the <strong>%2$s</strong> %3$s.',
						'This newsletter will be sent to <strong>%1$s contacts</strong> in the <strong>%2$s</strong> %3$s.',
						selected.count,
						'newspack-newsletters'
					),
					selected.count.toLocaleString(),
					selected.name,
					selected.typeLabel.toLowerCase()
			  );
		return (
			<p
				dangerouslySetInnerHTML={ {
					__html: summary,
				} }
			/>
		);
	};

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
				availableItems={ availableItems }
				onChange={ items => onChangeSendTo( items ) }
				formLabel={ __( 'Select a list or segment', 'newspack' ) }
				placeholder={ __( 'Type a list or segment name to search', 'newspack' ) }
				reset={ resetSendTo }
				selectedItem={ selected }
			/>
			{ renderSelectedSummary() }
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

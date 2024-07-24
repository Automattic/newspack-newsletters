/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import { Fragment, useEffect } from '@wordpress/element';
import { SelectControl, Spinner, Notice } from '@wordpress/components';

/**
 * Internal dependencies
 */
import SendTo from '../../newsletter-editor/sidebar/send-to';
import { getSuggestionLabel } from '../../newsletter-editor/utils';
import { getSubAudienceOptions, getSendToLabel, getSendToLink } from './utils';

const getSubAudienceValue = newsletterData => {
	const recipients = newsletterData.campaign?.recipients;

	const targetIdRawValue =
		recipients?.segment_opts?.saved_segment_id ||
		recipients?.segment_opts?.conditions[ 0 ]?.value ||
		'';
	const targetId =
		( Array.isArray( targetIdRawValue ) ? targetIdRawValue[ 0 ] : targetIdRawValue ).toString() ||
		'';
	const targetField = recipients?.segment_opts?.conditions?.length
		? recipients?.segment_opts?.conditions[ 0 ]?.field
		: '';
	if ( ! targetField || ! targetId ) {
		return false;
	}
	return 'Interests' === recipients?.segment_opts?.conditions[ 0 ]?.condition_type
		? `${ targetField || '' }:${ targetId }`
		: targetId;
};

const ProviderSidebarComponent = ( {
	renderCampaignName,
	renderSubject,
	renderFrom,
	renderPreviewText,
	inFlight,
	newsletterData,
	stringifiedLayoutDefaults,
	postId,
	updateMeta,
	createErrorNotice,
	meta,
	status,
} ) => {
	const campaign = newsletterData.campaign;

	// Separate out audiences from other data item types.
	const audiences = newsletterData?.lists
		? newsletterData.lists
				.filter( list => 'mailchimp-group' !== list.type && 'mailchimp-tag' !== list.type )
				.map( item => {
					const contactCount =
						item?.member_count || item?.subscriber_count || item?.stats?.member_count;
					const formattedItem = {
						...item,
						details: contactCount
							? sprintf(
									// Translators: %d is the number of contacts in the list.
									_n( '%d contact', '%d contacts', contactCount, 'newspack-newsletters' ),
									contactCount.toLocaleString()
							  )
							: null,
						name: item.name || item.title,
						typeLabel: __( 'Audience', 'newspack-newsletters' ),
						type: 'list',
						value: item.id,
					};

					formattedItem.label = getSuggestionLabel( formattedItem );

					return formattedItem;
				} )
		: [];
	const folders = newsletterData?.folders || [];

	useEffect( () => {
		fetchListsAndSegments();
	}, [] );

	const fetchListsAndSegments = async () => {
		try {
			const response = await apiFetch( {
				path: `/newspack-newsletters/v1/mailchimp/${ postId }/retrieve`,
			} );
			updateMeta( { newsletterData: response } );
		} catch ( e ) {
			createErrorNotice(
				e.message || __( 'Error retrieving campaign information.', 'newspack-newsletters' )
			);
		}
	};

	const setList = listId => {
		return apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/list/${ listId }`,
			method: 'POST',
		} ).then( response => updateMeta( { newsletterData: response } ) );
	};

	const getFolderOptions = () => {
		const options = folders.map( folder => ( {
			label: folder.name,
			value: folder.id,
		} ) );
		if ( ! campaign?.settings?.folder_id ) {
			options.unshift( {
				label: __( 'No folder', 'newspack-newsletters' ),
				value: '',
			} );
		}
		return options;
	};

	const setFolder = folder_id =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/folder`,
			method: 'POST',
			data: {
				folder_id,
			},
		} );

	const updateSegments = target_id => {
		return apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/segments`,
			method: 'POST',
			data: {
				target_id,
			},
		} ).then( response => updateMeta( { newsletterData: response } ) );
	};

	const setSender = ( { senderName, senderEmail } ) =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/sender`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		} );

	useEffect( () => {
		if ( campaign && campaign.settings ) {
			const { from_name, reply_to } = campaign.settings;
			updateMeta( {
				...( from_name
					? {
							senderName: from_name,
					  }
					: {} ),
				...( reply_to
					? {
							senderEmail: reply_to,
					  }
					: {} ),
			} );
		}
	}, [ campaign ] );

	// If there is a stringified newsletter data from the layout, use it to set the list and segments.
	useEffect( () => {
		try {
			const layoutDefaults = JSON.parse( stringifiedLayoutDefaults );
			if ( layoutDefaults.senderEmail && layoutDefaults.senderName ) {
				const existingSenderData = meta.senderEmail && meta.senderName;
				if ( ! existingSenderData ) {
					setSender( {
						senderName: layoutDefaults.senderName,
						senderEmail: layoutDefaults.senderEmail,
					} );
				}
			}
			if ( layoutDefaults.newsletterData?.campaign?.recipients?.list_id ) {
				const existingListId = newsletterData.campaign?.recipients?.list_id;
				if ( ! existingListId ) {
					setList( layoutDefaults.newsletterData?.campaign.recipients.list_id ).then( () => {
						const subAudienceValue = getSubAudienceValue( layoutDefaults.newsletterData );
						if ( subAudienceValue ) {
							updateSegments( subAudienceValue );
						}
					} );
				}
			}
		} catch ( e ) {
			// Ignore it.
		}
	}, [ stringifiedLayoutDefaults.length ] );

	if ( ! campaign ) {
		return (
			<div className="newspack-newsletters__loading-data">
				{ __( 'Retrieving Mailchimp data…', 'newspack-newsletters' ) }
				<Spinner />
			</div>
		);
	}

	if (
		! inFlight &&
		( 'publish' === status ||
			'private' === status ||
			'sent' === campaign?.status ||
			'sending' === campaign?.status )
	) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
		);
	}

	const { list_id: audienceId } = campaign.recipients || {};
	const subAudienceId = getSubAudienceValue( newsletterData );
	const subAudiences = getSubAudienceOptions( newsletterData );
	const selectedAudience = audienceId && audiences.find( ( { value } ) => audienceId === value );
	const selectedSubAudience =
		subAudienceId &&
		subAudiences.find( ( { value } ) => subAudienceId.toString() === value.toString() );
	const onChangeSendTo = labels => {
		const selectedLabel = labels[ 0 ];
		const items = [ ...audiences, ...subAudiences ];
		const selectedItem = items.find( item => item.label === selectedLabel );

		// If the selected item is already selected in the campaign, no need to update.
		if (
			! selectedItem ||
			selectedAudience?.value === selectedItem?.value ||
			selectedSubAudience?.value === selectedItem?.value
		) {
			return;
		}

		return selectedItem.list_type === 'audience'
			? setList( selectedItem.value )
			: updateSegments( selectedItem.value );
	};

	return (
		<Fragment>
			{ renderCampaignName() }
			{ renderSubject() }
			{ renderPreviewText() }
			<hr />
			{ folders.length ? (
				<Fragment>
					<SelectControl
						label={ __( 'Folder', 'newspack-newsletters' ) }
						value={ campaign?.settings?.folder_id }
						options={ getFolderOptions() }
						onChange={ setFolder }
						disabled={ inFlight }
					/>
					<hr />
				</Fragment>
			) : null }
			{ renderFrom( { handleSenderUpdate: setSender } ) }
			<hr />
			<strong className="newspack-newsletters__label">
				{ __( 'Send to', 'newspack-newsletters' ) }
			</strong>
			<SendTo
				availableItems={ audiences }
				onChange={ selected => onChangeSendTo( selected ) }
				formLabel={ __( 'Select a list', 'newspack' ) }
				getLabel={ getSendToLabel }
				getLink={ getSendToLink }
				placeholder={ __( 'Type a list name to search', 'newspack' ) }
				reset={ null } // Mailchimp API doesn't support unsetting a campaign's list, once set.
				selectedItem={ selectedAudience }
			/>
			{ selectedAudience && (
				<>
					<SendTo
						availableItems={ subAudiences }
						onChange={ onChangeSendTo }
						formLabel={ __( 'Group, Segment, or Tag (optional)', 'newspack' ) }
						placeholder={ __( 'Filter by group, segment, or tag', 'newspack' ) }
						reset={ () => updateSegments( '' ) }
						selectedItem={ selectedSubAudience }
					/>
				</>
			) }
			{ selectedAudience && (
				<p
					dangerouslySetInnerHTML={ {
						__html: sprintf(
							// Translators: %1$s is the number of members, %2$s is the item name, %3$s is the item type, %4$s is the parent item name and type (if any).
							__(
								'This newsletter will be sent to all %1$smembers of the %2$s %3$s%4$s.',
								'newspack-newsletters'
							),
							selectedAudience.details && ! isNaN( selectedAudience.details )
								? `<strong>${ selectedAudience.details.toLocaleString() }</strong>` + ' '
								: '',
							`<strong>${ selectedAudience.name }</strong>`,
							selectedAudience.typeLabel.toLowerCase(),
							selectedSubAudience
								? sprintf(
										// Translators: %1$s is the parent item name, %2$s is the parent item type.
										__( ' who are part of the %1$s %2$s', 'newspack-newsletters' ),
										`<strong>${ selectedSubAudience.name }</strong>`,
										selectedSubAudience.typeLabel.toLowerCase()
								  )
								: ''
						),
					} }
				/>
			) }
		</Fragment>
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

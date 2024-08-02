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
import { getSubAudienceOptions } from './utils';

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
					const count =
						item?.member_count || item?.subscriber_count || item?.stats?.member_count || null;
					const formattedItem = {
						...item,
						name: item.name || item.title,
						typeLabel: __( 'Audience', 'newspack-newsletters' ),
						type: 'list',
						value: item.id,
					};

					if ( null !== count ) {
						formattedItem.count = parseInt( count );
					}
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
					} : {} ),
				...( reply_to
					? {
						senderEmail: reply_to,
					} : {} ),
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

	const renderSelectedSummary = () => {
		if ( ! selectedAudience ) {
			return null;
		}

		const summary = selectedSubAudience?.count
			? sprintf(
					// Translators: A summary of which list and sublist the campaign is set to send to, and the total number of contacts, if available.  %1$s is the number of contacts. %2$s is the label of the list (ex: Main), %3$s is the label for the type of the list (ex: "list" on Active Campaign and "audience" on Mailchimp). %4$s is the label of the sublist (ex: "paid customers"), and %5$s is the label for the sublist type (ex: tag, group or segment)
					_n(
						'This newsletter will be sent to <strong>%1$s contact</strong> in the <strong>%2$s</strong> %3$s who is part of the <strong>%4$s</strong> %5$s.',
						'This newsletter will be sent to <strong>%1$s contacts</strong> in the <strong>%2$s</strong> %3$s who are part of the <strong>%4$s</strong> %5$s.',
						selectedSubAudience.count,
						'newspack-newsletters'
					),
					selectedSubAudience.count.toLocaleString(),
					selectedAudience.name,
					selectedAudience.typeLabel.toLowerCase(),
					selectedSubAudience.name,
					selectedSubAudience.typeLabel.toLowerCase()
			  )
			: sprintf(
					// Translators: A summary of which list the campaign is set to send to, and the total number of contacts, if available. %1$s is the number of contacts. %2$s is the label of the list (ex: Main), %3$s is the label for the type of the list (ex: "list" on Active Campaign and "audience" on Mailchimp).
					_n(
						'This newsletter will be sent to <strong>%1$s contact</strong> in the <strong>%2$s</strong> %3$s.',
						'This newsletter will be sent to <strong>%1$s contacts</strong> in the <strong>%2$s</strong> %3$s.',
						selectedAudience.count,
						'newspack-newsletters'
					),
					selectedAudience.count.toLocaleString(),
					selectedAudience.name,
					selectedAudience.typeLabel.toLowerCase()
			  );
		return (
			<p
				dangerouslySetInnerHTML={ {
					__html: summary,
				} }
			/>
		);
	};

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

		return 'list' === selectedItem.type
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
				onChange={ onChangeSendTo }
				formLabel={ __( 'Select an audience', 'newspack' ) }
				placeholder={ __( 'Type an audience name to search', 'newspack' ) }
				reset={ null } // Mailchimp API doesn't support unsetting a campaign's list, once set.
				selectedItem={ selectedAudience }
			/>
			{ selectedAudience && (
				<>
					<SendTo
						availableItems={ subAudiences }
						onChange={ onChangeSendTo }
						formLabel={ __( 'Filter by Group, Segment, or Tag (optional)', 'newspack' ) }
						placeholder={ __( 'Type a group, segment, or tag name to search', 'newspack' ) }
						reset={ () => updateSegments( '' ) }
						selectedItem={ selectedSubAudience }
					/>
				</>
			) }
			{ renderSelectedSummary() }
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

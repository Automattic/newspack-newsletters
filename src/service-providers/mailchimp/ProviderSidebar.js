/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { withSelect } from '@wordpress/data';
import { Fragment, useEffect } from '@wordpress/element';
import { ExternalLink, SelectControl, Spinner, Notice } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getGroupOptions, getSegmentOptions } from './utils';
import SelectControlWithOptGroup from '../../components/select-control-with-optgroup/';

const getSubAudienceOptions = newsletterData => {
	const groups = newsletterData?.interest_categories || [];
	const segments = newsletterData?.segments || [];
	const tags = newsletterData?.tags || [];
	let optGroups = [];

	if ( groups?.categories?.length > 0 ) {
		optGroups = optGroups.concat( getGroupOptions( groups ) );
	}

	if ( tags.length > 0 ) {
		optGroups.push( {
			label: __( 'Tags', 'newspack-newsletters' ),
			options: getSegmentOptions( tags ),
		} );
	}

	if ( segments.length > 0 ) {
		optGroups.push( {
			label: __( 'Segments', 'newspack-newsletters' ),
			options: getSegmentOptions( segments ),
		} );
	}
	return optGroups;
};

const SegmentsSelection = ( { onUpdate, inFlight, value, newsletterData } ) => {
	const optGroups = getSubAudienceOptions( newsletterData );
	if ( ! optGroups.length ) {
		return null;
	}
	return (
		<SelectControlWithOptGroup
			label={ __( 'Group, Segment, or Tag', 'newspack-newsletters' ) }
			deselectedOptionLabel={ __( 'All subscribers in audience', 'newspack-newsletters' ) }
			optgroups={ optGroups }
			value={ value }
			onChange={ id => onUpdate( id.toString() ) }
			disabled={ inFlight }
		/>
	);
};

const getSubAudienceValue = newsletterData => {
	const recipients = newsletterData.campaign?.recipients;

	const targetIdRawValue =
		recipients?.segment_opts?.saved_segment_id ||
		recipients?.segment_opts?.conditions[ 0 ]?.value ||
		'';
	const targetId =
		( Array.isArray( targetIdRawValue ) ? targetIdRawValue[ 0 ] : targetIdRawValue ).toString() ||
		'';
	const targetField =
		! recipients?.segment_opts?.saved_segment_id && recipients?.segment_opts?.conditions?.length
			? recipients?.segment_opts?.conditions[ 0 ]?.field
			: '';
	if ( ! targetField && ! targetId ) {
		return false;
	}
	return 'Interests' === ! recipients?.segment_opts?.saved_segment_id &&
		recipients?.segment_opts?.conditions[ 0 ]?.condition_type
		? `${ targetField || '' }:${ targetId }`
		: targetId;
};

const ProviderSidebar = ( {
	renderCampaignName,
	renderSubject,
	renderFrom,
	renderPreviewText,
	inFlight,
	newsletterData,
	stringifiedLayoutDefaults,
	apiFetch,
	postId,
	updateMeta,
	createErrorNotice,
	meta,
} ) => {
	const campaign = newsletterData.campaign;

	// Separate out audiences from other data item types.
	const audiences = newsletterData?.lists
		? newsletterData.lists.filter(
				list => 'mailchimp-group' !== list.type && 'mailchimp-tag' !== list.type
		  )
		: [];
	const folders = newsletterData?.folders || [];

	const setDefaultsFromLayout = () => {
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
	};

	useEffect( () => {
		const performSetup = async () => {
			await fetchListsAndSegments();
			// If there is a stringified newsletter data from the layout, use it to set the list and segments.
			if ( stringifiedLayoutDefaults.length ) {
				setDefaultsFromLayout();
			}
		};
		performSetup();
	}, [] );

	const fetchListsAndSegments = async () => {
		try {
			const response = await apiFetch( {
				path: `/newspack-newsletters/v1/mailchimp/${ postId }/retrieve`,
			} );
			updateMeta( 'newsletterData', response );
		} catch ( e ) {
			createErrorNotice(
				e.message || __( 'Error retrieving campaign information.', 'newspack-newsletters' )
			);
		}
	};

	const setList = listId =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/list/${ listId }`,
			method: 'POST',
		} );

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
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/segments`,
			method: 'POST',
			data: {
				target_id,
			},
		} );
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

	if ( ! campaign ) {
		return (
			<div className="newspack-newsletters__loading-data">
				{ __( 'Retrieving Mailchimp data…', 'newspack-newsletters' ) }
				<Spinner />
			</div>
		);
	}

	const { status } = campaign || {};

	if ( 'sent' === status || 'sending' === status ) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
		);
	}

	const { list_id: audienceId } = campaign.recipients || {};
	const list = audienceId && audiences.find( ( { id } ) => audienceId === id );
	const { web_id: listWebId } = list || {};

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
			<SelectControl
				label={ __( 'Audience', 'newspack-newsletters' ) }
				className="newspack-newsletters__to-selectcontrol"
				value={ audienceId }
				options={ [
					{
						value: null,
						label: __( '-- Select an audience --', 'newspack-newsletters' ),
					},
					...audiences.map( ( { id, name } ) => ( {
						value: id,
						label: name,
					} ) ),
				] }
				onChange={ setList }
				disabled={ inFlight }
			/>
			{ listWebId && (
				<p>
					<ExternalLink href={ `https://admin.mailchimp.com/lists/members/?id=${ listWebId }` }>
						{ __( 'Manage audience', 'newspack-newsletters' ) }
					</ExternalLink>
				</p>
			) }
			<SegmentsSelection
				value={ getSubAudienceValue( newsletterData ) }
				newsletterData={ newsletterData }
				inFlight={ inFlight }
				onUpdate={ updateSegments }
			/>
		</Fragment>
	);
};

const mapStateToProps = select => {
	const { getEditedPostAttribute } = select( 'core/editor' );
	return {
		meta: getEditedPostAttribute( 'meta' ),
	};
};

export default withSelect( mapStateToProps )( ProviderSidebar );

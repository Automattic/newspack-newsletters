/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment, useEffect } from '@wordpress/element';
import { ExternalLink, SelectControl, Spinner, Notice } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getListInterestsSettings } from './utils';

const getSegmentationOptions = ( availableInterests, availableSegments ) => {
	let options = [];
	if ( availableInterests.length > 0 ) {
		options = options.concat( [
			{
				label: __( 'Group', 'newspack-newsletters' ),
				value: 'groups',
				disabled: true,
			},
			...availableInterests,
		] );
	}
	if ( availableSegments.length > 0 ) {
		options = options.concat( [
			{
				label: __( 'Segment or tag', 'newspack-newsletters' ),
				value: 'segments',
				disabled: true,
			},
			...availableSegments.map( segment => ( {
				label: ` - ${ segment.name }`,
				value: segment.id.toString(),
			} ) ),
		] );
	}
	return options;
};

const SegmentsSelection = ( { onUpdate, inFlight, targetField, targetId, options = [] } ) => {
	if ( ! options.length ) {
		return null;
	}
	return (
		<SelectControl
			label={ __( 'Group, segment, or tag', 'newspack-newsletters' ) }
			value={ `${ targetField || '' }:${ targetId }` }
			options={ [
				{
					label: __( 'All subscribers in audience', 'newspack-newsletters' ),
					value: '',
				},
				...options,
			] }
			onChange={ id => onUpdate( id.toString() ) }
			disabled={ inFlight }
		/>
	);
};

const ProviderSidebar = ( {
	renderCampaignName,
	renderSubject,
	renderFrom,
	renderPreviewText,
	inFlight,
	newsletterData,
	stringifiedNewsletterDataFromLayout,
	apiFetch,
	postId,
	updateMeta,
} ) => {
	const campaign = newsletterData.campaign;
	const lists =
		newsletterData.lists && newsletterData.lists.length
			? newsletterData.lists.filter( list => list.type !== 'mailchimp-group' )
			: [];
	const folders = newsletterData.folders || [];
	const segments = newsletterData.segments || newsletterData.tags || []; // Keep .tags for backwards compatibility.

	const setList = listId =>
		console.log( 'set list! ', listId ) ||
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

	const updateSegments = target_id =>
		console.log( 'set segments! ', target_id ) ||
		// TODO: on first render after choosing the layout, this errors out with
		// Mailchimp list ID not found.
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/segments`,
			method: 'POST',
			data: {
				target_id,
			},
		} );

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

	useEffect( () => {
		try {
			const newsletterDataFromLayout = JSON.parse( stringifiedNewsletterDataFromLayout );
			if ( newsletterDataFromLayout.campaign?.recipients?.list_id ) {
				setList( newsletterDataFromLayout.campaign.recipients.list_id );
				const interestSettings = getListInterestsSettings( newsletterDataFromLayout );
				if ( interestSettings.interestValue ) {
					updateSegments( interestSettings.interestValue );
				}
			}
		} catch ( e ) {
			// Ignore it.
		}
	}, [ stringifiedNewsletterDataFromLayout.length ] );

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

	const { list_id } = campaign.recipients || {};
	const list = list_id && lists.find( ( { id } ) => list_id === id );
	const { web_id: listWebId } = list || {};

	const recipients = newsletterData.campaign?.recipients;

	const targetId =
		recipients?.segment_opts?.saved_segment_id ||
		recipients?.segment_opts?.conditions[ 0 ]?.value ||
		'';

	const targetField = recipients?.segment_opts?.conditions?.length
		? recipients?.segment_opts?.conditions[ 0 ]?.field
		: '';

	const interestSettings = getListInterestsSettings( newsletterData );

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
				value={ list_id }
				options={ [
					{
						value: null,
						label: __( '-- Select an audience --', 'newspack-newsletters' ),
					},
					...lists.map( ( { id, name } ) => ( {
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
				targetId={ ( Array.isArray( targetId ) ? targetId[ 0 ] : targetId ).toString() || '' }
				targetField={ targetField }
				options={ getSegmentationOptions(
					interestSettings.options,
					segments.filter( segment => segment.member_count > 0 )
				) }
				apiFetch={ apiFetch }
				inFlight={ inFlight }
				onUpdate={ updateSegments }
			/>
		</Fragment>
	);
};

export default ProviderSidebar;

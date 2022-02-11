/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment, useEffect, useState } from '@wordpress/element';
import { ExternalLink, SelectControl, Spinner, Notice } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getListInterestsSettings } from './utils';

const SegmentsSelection = ( {
	onUpdate,
	inFlight,
	targetField,
	chosenTarget,
	availableInterests,
	availableSegments,
} ) => {
	const [ targetId, setTargetId ] = useState( chosenTarget.toString() || '' );

	const [ isInitial, setIsInitial ] = useState( true );
	useEffect( () => {
		if ( ! isInitial ) {
			onUpdate( targetId );
		}
		setIsInitial( false );
	}, [ targetId ] );

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

	useEffect( () => {
		if ( targetId !== '' && ! options.find( option => option.value === targetId ) ) {
			const foundOption = options.find(
				option => option.value && option.value === `${ targetField || '' }:${ targetId }`
			);
			if ( foundOption ) setTargetId( foundOption.value );
		}
	}, [ targetId ] );

	return (
		<Fragment>
			{ options.length ? (
				<SelectControl
					label={ __( 'Group, segment, or tag', 'newspack-newsletters' ) }
					value={ targetId }
					options={ [
						{
							label: __( 'All subscribers in audience', 'newspack-newsletters' ),
							value: '',
						},
						...options,
					] }
					onChange={ id => setTargetId( id.toString() ) }
					disabled={ inFlight }
				/>
			) : null }
		</Fragment>
	);
};

const ProviderSidebar = ( {
	renderFrom,
	renderPreviewText,
	inFlight,
	newsletterData,
	apiFetch,
	postId,
	updateMeta,
} ) => {
	const campaign = newsletterData.campaign;
	const lists = newsletterData.lists || [];
	const segments = newsletterData.segments || newsletterData.tags || []; // Keep .tags for backwards compatibility.

	const setList = listId =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/list/${ listId }`,
			method: 'POST',
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

	const { list_id } = campaign.recipients || {};
	const list = list_id && lists.find( ( { id } ) => list_id === id );
	const { web_id: listWebId } = list || {};

	const recipients = newsletterData.campaign?.recipients;

	const chosenTarget =
		recipients?.segment_opts?.saved_segment_id ||
		recipients?.segment_opts?.conditions[ 0 ]?.value ||
		'';

	const targetField = recipients?.segment_opts?.conditions?.length
		? recipients?.segment_opts?.conditions[ 0 ]?.field
		: '';

	const interestSettings = getListInterestsSettings( newsletterData );

	return (
		<Fragment>
			{ renderPreviewText() }
			<hr />
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
				chosenTarget={ Array.isArray( chosenTarget ) ? chosenTarget[ 0 ] : chosenTarget }
				targetField={ targetField }
				availableInterests={ interestSettings.options }
				availableSegments={ segments.filter( segment => segment.member_count > 0 ) }
				apiFetch={ apiFetch }
				inFlight={ inFlight }
				onUpdate={ updateSegments }
			/>
		</Fragment>
	);
};

export default ProviderSidebar;

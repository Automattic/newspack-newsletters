/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment, useEffect, useState } from '@wordpress/element';
import {
	BaseControl,
	CheckboxControl,
	SelectControl,
	RadioControl,
	Spinner,
	Notice,
} from '@wordpress/components';

const ProviderSidebar = ( {
	renderSubject,
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
	const segments = newsletterData.segments || [];

	const [ sendMode, setSendMode ] = useState( 'list' );

	let segment_id = '';
	if ( campaign?.activity?.segment_ids?.length ) {
		segment_id = campaign.activity.segment_ids[ 0 ];
	}

	const setList = ( listId, value ) => {
		const method = value ? 'PUT' : 'DELETE';
		apiFetch( {
			path: `/newspack-newsletters/v1/constant_contact/${ postId }/list/${ listId }`,
			method,
		} );
	};

	const setSegment = segmentId => {
		const method = segmentId ? 'PUT' : 'DELETE';
		apiFetch( {
			path: `/newspack-newsletters/v1/constant_contact/${ postId }/segment/${ segmentId }`,
			method,
		} );
	};

	const setSender = ( { senderName, senderEmail } ) =>
		apiFetch( {
			path: `/newspack-newsletters/v1/constant_contact/${ postId }/sender`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		} );

	useEffect( () => {
		if ( campaign ) {
			updateMeta( {
				senderName: campaign.activity.from_name,
				senderEmail: campaign.activity.from_email,
			} );
			if ( campaign?.activity?.contact_list_ids?.length ) {
				setSendMode( 'list' );
			} else if ( campaign?.activity?.segment_ids?.length ) {
				setSendMode( 'segment' );
			}
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

	const { current_status: status } = campaign || {};
	if ( 'DRAFT' !== status ) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
		);
	}

	return (
		<Fragment>
			{ renderSubject() }
			{ renderPreviewText() }
			<hr />
			{ renderFrom( { handleSenderUpdate: setSender } ) }
			<hr />
			<strong className="newspack-newsletters__label">
				{ __( 'Send to', 'newspack-newsletters' ) }
			</strong>
			<BaseControl className="newspack-newsletters__send-mode">
				<RadioControl
					className={
						'newspack-newsletters__sendmode-radiocontrol' + ( inFlight ? ' inFlight' : '' )
					}
					label={ __( 'Send Mode', 'newspack-newsletters' ) }
					selected={ sendMode }
					onChange={ setSendMode }
					options={ [
						{ label: __( 'List', 'newspack-newsletters' ), value: 'list' },
						{ label: __( 'Segment', 'newspack-newsletters' ), value: 'segment' },
					] }
					disabled={ inFlight }
				/>
			</BaseControl>

			{ 'list' === sendMode && (
				<BaseControl
					id="newspack-newsletters-constant_contact-lists"
					label={ __( 'Lists', 'newspack-newsletters' ) }
				>
					{ lists.map( ( { list_id: id, name } ) => (
						<CheckboxControl
							key={ id }
							label={ name }
							value={ id }
							checked={ campaign?.activity?.contact_list_ids?.some( listId => listId === id ) }
							onChange={ value => setList( id, value ) }
							disabled={ inFlight }
						/>
					) ) }
				</BaseControl>
			) }
			{ 'segment' === sendMode && (
				<SelectControl
					label={ __( 'Segment', 'newspack-newsletters' ) }
					className="newspack-newsletters-constant_contact-segments"
					value={ segment_id }
					options={ [
						{
							value: null,
							label: __( '-- Select a segment --', 'newspack-newsletters' ),
						},
						...segments.map( ( { segment_id: id, name } ) => ( {
							value: id,
							label: name,
						} ) ),
					] }
					onChange={ setSegment }
					disabled={ inFlight }
				/>
			) }
		</Fragment>
	);
};

export default ProviderSidebar;

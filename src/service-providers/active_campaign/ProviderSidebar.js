/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { Spinner, TextControl, Notice } from '@wordpress/components';

/**
 * External dependencies
 */
import { pick } from 'lodash';

/**
 * Internal dependencies
 */
import SendTo from '../../newsletter-editor/sidebar/send-to';
import './style.scss';

const getSendToLabel = ( item, type = 'list' ) => {
	const isList = 'list' === type;
	return sprintf(
		// Translators: %1$s is the type of list or segment, %2$s is the name of the list or segment, %3$s is the number of contacts in the list.
		__( '[%1$s] %2$s %3$s', 'newspack-newsletters' ),
		isList ? __( 'LIST', 'newspack-newsletters' ) : __( 'SEGMENT', 'newspack-newsletters' ),
		item.name,
		sprintf(
			// Translators: more details on the list or segment.
			__( '(%s)', 'newspack-newsletters' ),
			isList
				? item.subscriber_count + __( ' contacts', 'newspack-newsletters' )
				: __( 'id: ', 'newspack-newsletters' ) + item.id
		)
	).trim();
};

/**
 * Validation utility.
 *
 * @param {Object} data            Data returned from the ESP retrieve method.
 * @param {string} data.from_email Sender email address.
 * @param {string} data.from_name  Sender name.
 * @param {number} data.list_id    Recipient list ID.
 * @return {string[]} Array of validation messages. If empty, newsletter is valid.
 */
export const validateNewsletter = ( { from_email, from_name, list_id } ) => {
	const messages = [];
	if ( ! from_email || ! from_name ) {
		messages.push( __( 'Missing required sender info.', 'newspack-newsletters' ) );
	}
	if ( ! list_id ) {
		messages.push( __( 'Must select a list when sending in list mode', 'newspack-newsletters' ) );
	}
	return messages;
};

const AC_DATA_METADATA_KEYS = [ 'ac_list_id', 'ac_segment_id', 'ac_from_name', 'ac_from_email' ];

/**
 * Component to be rendered in the sidebar panel.
 * Has full control over the panel contents rendering,
 * so that it's possible to render e.g. a loader while
 * the data is not yet available.
 *
 * @param {Object}   props                           Component props.
 * @param {number}   props.postId                    ID of the edited newsletter post.
 * @param {Function} props.renderCampaignName        Function that renders campaign name input.
 * @param {Function} props.renderSubject             Function that renders email subject input.
 * @param {Function} props.renderPreviewText         Function that renders email preview text input.
 * @param {boolean}  props.inFlight                  True if the component is in a loading state.
 * @param {Object}   props.acData                    ActiveCampaign data.
 * @param {Function} props.updateMeta                Dispatcher to update post meta.
 * @param {Object}   props.newsletterData            Newsletter data from the parent components
 * @param {Function} props.createErrorNotice         Dispatcher to display an error message in the editor.
 * @param {string}   props.status                    Current post status.
 * @param {string}   props.stringifiedLayoutDefaults Stringified newsletter data from the layout.
 */
const ProviderSidebarComponent = ( {
	postId,
	renderCampaignName,
	renderSubject,
	renderPreviewText,
	inFlight,
	acData,
	updateMeta,
	newsletterData,
	createErrorNotice,
	status,
	stringifiedLayoutDefaults,
} ) => {
	const [ lists, setLists ] = useState( [] );
	const [ segments, setSegments ] = useState( [] );
	const [ selectedList, setSelectedList ] = useState( null );
	const [ selectedSegment, setSelectedSegment ] = useState( null );

	useEffect( () => {
		fetchListsAndSegments();
	}, [] );

	const fetchListsAndSegments = async () => {
		try {
			const response = await apiFetch( {
				path: `/newspack-newsletters/v1/active_campaign/${ postId }/retrieve`,
			} );
			setLists(
				response.lists.map( list => {
					return {
						...list,
						value: list.id,
						label: getSendToLabel( list ),
					};
				} )
			);
			setSegments(
				response.segments.map( segment => {
					return {
						...segment,
						value: segment.id,
						label: getSendToLabel( segment, 'segment' ),
					};
				} )
			);
		} catch ( e ) {
			createErrorNotice(
				e.message || __( 'Error retrieving campaign information.', 'newspack-newsletters' )
			);
		}
	};

	useEffect( () => {
		const updatedData = {
			...newsletterData,
			lists,
			list_id: acData.ac_list_id,
			segment_id: acData.ac_segment_id,
			from_email: acData.ac_from_email,
			from_name: acData.ac_from_name,
			campaign: true,
		};
		if ( acData.ac_list_id ) {
			setSelectedList( lists.find( list => list.id === acData.ac_list_id ) );
		} else {
			setSelectedList( null );
		}
		if ( acData.ac_segment_id ) {
			setSelectedSegment( segments.find( segment => segment.id === acData.ac_segment_id ) );
		} else {
			setSelectedSegment( null );
		}
		updateMeta( { newsletterData: updatedData } );
	}, [ JSON.stringify( acData ), lists, status ] );

	// If there is a stringified newsletter data from the layout, use it to set the list and segments.
	useEffect( () => {
		try {
			const layoutDefaults = JSON.parse( stringifiedLayoutDefaults );
			if ( layoutDefaults && layoutDefaults.newsletterData ) {
				AC_DATA_METADATA_KEYS.forEach( key => {
					const layoutKey = key.replace( 'ac_', '' );
					if ( ! acData[ key ] && layoutDefaults.newsletterData[ layoutKey ] ) {
						const updatedMeta = {};
						updatedMeta[ key ] = layoutDefaults.newsletterData[ layoutKey ];
						updateMeta( updatedMeta );
					}
				} );
			}
		} catch ( e ) {
			// Ignore it.
		}
	}, [ stringifiedLayoutDefaults.length ] );

	const onChangeSendTo = async ( labels, type = 'list' ) => {
		const isList = 'list' === type;
		const selectedLabel = labels[ 0 ];
		const items = isList ? [ ...lists ] : [ ...segments ];
		const selectedItem = items.find(
			item => getSendToLabel( item, isList ? 'list' : 'segment' ) === selectedLabel
		);
		const metaKey = isList ? 'ac_list_id' : 'ac_segment_id';
		const updatedMeta = {};
		updatedMeta[ metaKey ] = selectedItem?.id || '';
		updateMeta( updatedMeta );
		return selectedItem;
	};

	if ( ! inFlight && ( 'publish' === status || 'private' === status ) ) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
		);
	}

	if ( ! lists?.length ) {
		return (
			<div className="newspack-newsletters__loading-data">
				{ __( 'Retrieving ActiveCampaign data…', 'newspack-newsletters' ) }
				<Spinner />
			</div>
		);
	}

	return (
		<div className="newspack-newsletters__campaign-monitor-sidebar">
			{ renderCampaignName() }
			{ renderSubject() }
			{ renderPreviewText() }
			<hr />
			<strong className="newspack-newsletters__label">
				{ __( 'From', 'newspack-newsletters' ) }
			</strong>
			<TextControl
				label={ __( 'Name', 'newspack-newsletters' ) }
				className="newspack-newsletters__name-textcontrol"
				value={ acData.ac_from_name }
				disabled={ inFlight }
				onChange={ value => updateMeta( { ac_from_name: value } ) }
			/>
			<TextControl
				label={ __( 'Email', 'newspack-newsletters' ) }
				className="newspack-newsletters__email-textcontrol"
				value={ acData.ac_from_email }
				type="email"
				disabled={ inFlight }
				onChange={ value => updateMeta( { ac_from_email: value } ) }
			/>
			<strong className="newspack-newsletters__label">
				{ __( 'Send to', 'newspack-newsletters' ) }
			</strong>
			<SendTo
				availableLists={ lists }
				onChange={ selected => onChangeSendTo( selected ) }
				formLabel={ __( 'Select a list', 'newspack' ) }
				getLabel={ getSendToLabel }
				placeholder={ __( 'Type a list name to search.', 'newspack' ) }
				reset={ async () => {
					updateMeta( { ac_list_id: '' } );
					updateMeta( { ac_segment_id: '' } );
				} }
				selectedList={ selectedList }
			/>
			{ selectedList && (
				<>
					<hr />
					<SendTo
						availableLists={ segments }
						onChange={ selected => onChangeSendTo( selected, 'segment' ) }
						formLabel={ __( 'Select a segment (optional)', 'newspack' ) }
						getLabel={ item => getSendToLabel( item, 'segment' ) }
						placeholder={ __( 'Type a segment name to search.', 'newspack' ) }
						reset={ async () => updateMeta( { ac_segment_id: '' } ) }
						selectedList={ selectedSegment }
					/>
				</>
			) }
			{ inFlight && <Spinner /> }
		</div>
	);
};

const mapStateToProps = select => {
	const { getCurrentPostAttribute, getEditedPostAttribute } = select( 'core/editor' );
	return {
		acData: pick( getEditedPostAttribute( 'meta' ), AC_DATA_METADATA_KEYS ),
		status: getCurrentPostAttribute( 'status' ),
	};
};

export const ProviderSidebar = compose( [ withSelect( mapStateToProps ) ] )(
	ProviderSidebarComponent
);

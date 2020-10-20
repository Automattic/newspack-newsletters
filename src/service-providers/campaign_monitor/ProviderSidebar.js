/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { compose } from '@wordpress/compose';
import { withDispatch, withSelect } from '@wordpress/data';
import { Fragment, useEffect, useState } from '@wordpress/element';
import {
	BaseControl,
	ExternalLink,
	RadioControl,
	SelectControl,
	TextControl,
	Notice,
} from '@wordpress/components';

/**
 * Component to be rendered in the sidebar panel.
 * Has full control over the panel contents rendering,
 * so that it's possible to render e.g. a loader while
 * the data is not yet available.
 *
 * @param {Object} props props
 */
const ProviderSidebarComponent = ( {
	/**
	 * ID of the edited newsletter post.
	 */
	postId,

	/**
	 * Function that renders email subject input.
	 */
	renderSubject,

	/**
	 * Whether or not the post is in a loading state.
	 */
	inFlight,

	/**
	 * Campaign Monitor data.
	 */
	cmData,

	/**
	 * Dispatcher to update post meta.
	 */
	updateMetaValue,

	/**
	 * Newsletter data from the parent components
	 */
	newsletterData,

	/**
	 * Dispatcher to display an error message in the editor.
	 */
	createErrorNotice,

	/**
	 * Current post status.
	 */
	status,
} ) => {
	const [ lists, setLists ] = useState( [] );
	const [ segments, setSegments ] = useState( [] );
	const { listId, segmentId, sendMode, senderName, senderEmail } = cmData;

	useEffect(() => {
		fetchListsAndSegments();
	}, []);

	const fetchListsAndSegments = async () => {
		try {
			const response = await apiFetch( {
				path: `/newspack-newsletters/v1/campaign_monitor/${ postId }/retrieve`,
			} );

			setLists( response.lists );
			setSegments( response.segments );

			// TODO: the below attempts to pass the selecdted list/segment name to the presend check modal, but it only works if the ProviderSidebar is currently mounted and has run this function.
			if ( 'list' === sendMode && listId ) {
				const list = response.lists.find( thisList => listId === thisList.ListID );
				updateMetaValue( 'newsletterData', { ...newsletterData, listName: list.Name } );
			}

			if ( 'segment' === sendMode && segmentId ) {
				const segment = response.segments.find(
					thisSegment => segmentId === thisSegment.SegmentID
				);
				updateMetaValue( 'newsletterData', { ...newsletterData, listName: segment.Title } );
			}
		} catch ( e ) {
			// TODO: The error handling is not working if sending fails. Also, the "Campaign Sent" notice gets shown regardless of whether the campaign got successfully sent.
			createErrorNotice(
				e.message || __( 'Error retrieving campaign information.', 'newspack-newsletters' )
			);
		}
	};

	if ( ! inFlight && 'publish' === status ) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
		);
	}

	return (
		<Fragment>
			{ renderSubject() }

			<BaseControl className="newspack-newsletters__send-mode">
				<RadioControl
					className="newspack-newsletters__sendmode-radiocontrol"
					label={ __( 'Send Mode', 'newspack-newsletters' ) }
					selected={ sendMode }
					onChange={ value => updateMetaValue( 'cm_send_mode', value ) }
					options={ [
						{ label: __( 'List', 'newspack-newsletters' ), value: 'list' },
						{ label: __( 'Segment', 'newspack-newsletters' ), value: 'segment' },
					] }
					disabled={ inFlight }
				/>
			</BaseControl>

			{ 'list' === sendMode && lists && (
				<BaseControl className="newspack-newsletters__list-select">
					<SelectControl
						label={ __( 'To', 'newspack-newsletters' ) }
						className="newspack-newsletters__to-selectcontrol"
						value={ listId }
						options={ [
							{
								value: '',
								label: __( '-- Select a subscriber list --', 'newspack-newsletters' ),
							},
							...lists.map( ( { ListID, Name } ) => ( {
								value: ListID,
								label: Name,
							} ) ),
						] }
						onChange={ value => updateMetaValue( 'cm_list_id', value ) }
						disabled={ inFlight || ! lists.length }
					/>
				</BaseControl>
			) }

			{ 'segment' === sendMode && segments && (
				<BaseControl className="newspack-newsletters__list-select">
					<SelectControl
						label={ __( 'To', 'newspack-newsletters' ) }
						className="newspack-newsletters__to-selectcontrol"
						value={ segmentId }
						options={ [
							{
								value: '',
								label: __( '-- Select a subscriber segment --', 'newspack-newsletters' ),
							},
							...segments.map( ( { SegmentID, Title } ) => ( {
								value: SegmentID,
								label: Title,
							} ) ),
						] }
						onChange={ value => updateMetaValue( 'cm_segment_id', value ) }
						disabled={ inFlight || ! segments.length }
					/>
				</BaseControl>
			) }

			<p>
				{ 'list' === sendMode ? (
					<ExternalLink href={ 'https://help.campaignmonitor.com/create-a-subscriber-list' }>
						{ __( 'Manage lists on Campaign Monitor', 'newspack-newsletters' ) }
					</ExternalLink>
				) : (
					<ExternalLink href={ 'https://help.campaignmonitor.com/list-segmentation' }>
						{ __( 'Manage segments on Campaign Monitor', 'newspack-newsletters' ) }
					</ExternalLink>
				) }
			</p>

			<strong>{ __( 'From', 'newspack-newsletters' ) }</strong>
			<TextControl
				label={ __( 'Name', 'newspack-newsletters' ) }
				className="newspack-newsletters__name-textcontrol"
				value={ senderName }
				disabled={ inFlight }
				onChange={ value => updateMetaValue( 'cm_from_name', value ) }
			/>
			<TextControl
				label={ __( 'Email', 'newspack-newsletters' ) }
				className="newspack-newsletters__email-textcontrol"
				value={ senderEmail }
				type="email"
				disabled={ inFlight }
				onChange={ value => updateMetaValue( 'cm_from_email', value ) }
			/>
		</Fragment>
	);
};

const mapStateToProps = select => {
	const { getEditedPostAttribute } = select( 'core/editor' );
	const meta = getEditedPostAttribute( 'meta' );

	return {
		cmData: {
			listId: meta.cm_list_id,
			segmentId: meta.cm_segment_id,
			sendMode: meta.cm_send_mode,
			senderName: meta.cm_from_name,
			senderEmail: meta.cm_from_email,
		},
		status: getEditedPostAttribute( 'status' ),
	};
};

const mapDispatchToProps = dispatch => {
	const { editPost } = dispatch( 'core/editor' );
	const { createErrorNotice } = dispatch( 'core/notices' );

	return {
		updateMetaValue: ( key, value ) => editPost( { meta: { [ key ]: value } } ),
		createErrorNotice,
	};
};

const ProviderSidebar = compose( [
	withSelect( mapStateToProps ),
	withDispatch( mapDispatchToProps ),
] )( ProviderSidebarComponent );

export default ProviderSidebar;

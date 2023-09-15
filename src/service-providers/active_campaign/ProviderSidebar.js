/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { compose } from '@wordpress/compose';
import { withDispatch, withSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { BaseControl, SelectControl, Spinner, TextControl, Notice } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './style.scss';

/**
 * Validation utility.
 *
 * @param {Object} data            Data fetched using getFetchDataConfig.
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

/**
 * Component to be rendered in the sidebar panel.
 * Has full control over the panel contents rendering,
 * so that it's possible to render e.g. a loader while
 * the data is not yet available.
 *
 * @param {Object}   props                    Component props.
 * @param {number}   props.postId             ID of the edited newsletter post.
 * @param {Function} props.renderCampaignName Function that renders campaign name input.
 * @param {Function} props.renderSubject      Function that renders email subject input.
 * @param {Function} props.renderPreviewText  Function that renders email preview text input.
 * @param {boolean}  props.inFlight           True if the component is in a loading state.
 * @param {Object}   props.acData             ActiveCampaign data.
 * @param {Function} props.updateMetaValue    Dispatcher to update post meta.
 * @param {Object}   props.newsletterData     Newsletter data from the parent components
 * @param {Function} props.createErrorNotice  Dispatcher to display an error message in the editor.
 * @param {string}   props.status             Current post status.
 */
const ProviderSidebarComponent = ( {
	postId,
	renderCampaignName,
	renderSubject,
	renderPreviewText,
	inFlight,
	acData,
	updateMetaValue,
	newsletterData,
	createErrorNotice,
	status,
} ) => {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ lists, setLists ] = useState( [] );
	const [ segments, setSegments ] = useState( [] );
	const { listId, segmentId, senderName, senderEmail } = acData;

	useEffect( () => {
		fetchListsAndSegments();
	}, [] );

	const fetchListsAndSegments = async () => {
		setIsLoading( true );
		try {
			const response = await apiFetch( {
				path: `/newspack-newsletters/v1/active_campaign/${ postId }/retrieve`,
			} );
			setLists( response.lists );
			setSegments( response.segments );
		} catch ( e ) {
			createErrorNotice(
				e.message || __( 'Error retrieving campaign information.', 'newspack-newsletters' )
			);
		}
		setIsLoading( false );
	};

	useEffect( () => {
		const updatedData = {
			...newsletterData,
			lists,
			list_id: listId,
			segment_id: segmentId,
			from_email: senderEmail,
			from_name: senderName,
			campaign: true,
		};
		updateMetaValue( 'newsletterData', updatedData );
	}, [ JSON.stringify( acData ), lists, status ] );

	if ( ! inFlight && 'publish' === status ) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
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
				value={ senderName }
				disabled={ inFlight }
				onChange={ value => updateMetaValue( 'ac_from_name', value ) }
			/>
			<TextControl
				label={ __( 'Email', 'newspack-newsletters' ) }
				className="newspack-newsletters__email-textcontrol"
				value={ senderEmail }
				type="email"
				disabled={ inFlight }
				onChange={ value => updateMetaValue( 'ac_from_email', value ) }
			/>
			<hr />
			<strong className="newspack-newsletters__label">
				{ __( 'Send to', 'newspack-newsletters' ) }
			</strong>
			<BaseControl className="newspack-newsletters__list-select">
				<SelectControl
					label={ __( 'To', 'newspack-newsletters' ) }
					value={ listId }
					options={ [
						{
							value: '',
							label: __( '-- Select a list --', 'newspack-newsletters' ),
						},
						...lists.map( ( { id, name } ) => ( {
							value: id,
							label: name,
						} ) ),
					] }
					onChange={ value => updateMetaValue( 'ac_list_id', value ) }
					disabled={ isLoading }
				/>
				{ listId && (
					<SelectControl
						label={ __( 'Segment', 'newspack-newsletters' ) }
						value={ segmentId }
						options={ [
							{
								value: '',
								label: __( '-- Select a segment (optional) --', 'newspack-newsletters' ),
							},
							...segments.map( ( { id, name } ) => ( {
								value: id,
								label: name,
							} ) ),
						] }
						onChange={ value => updateMetaValue( 'ac_segment_id', value ) }
						disabled={ isLoading }
					/>
				) }
				{ isLoading && <Spinner /> }
			</BaseControl>
		</div>
	);
};

const mapStateToProps = select => {
	const { getCurrentPostAttribute, getEditedPostAttribute } = select( 'core/editor' );
	const meta = getEditedPostAttribute( 'meta' );

	return {
		acData: {
			listId: meta.ac_list_id,
			segmentId: meta.ac_segment_id,
			senderName: meta.ac_from_name,
			senderEmail: meta.ac_from_email,
		},
		status: getCurrentPostAttribute( 'status' ),
	};
};

const mapDispatchToProps = dispatch => {
	const { editPost } = dispatch( 'core/editor' );
	const { createErrorNotice } = dispatch( 'core/notices' );

	return {
		updateMetaValue: ( key, value ) => {
			return editPost( { meta: { [ key ]: value } } );
		},
		createErrorNotice,
	};
};

export const ProviderSidebar = compose( [
	withSelect( mapStateToProps ),
	withDispatch( mapDispatchToProps ),
] )( ProviderSidebarComponent );

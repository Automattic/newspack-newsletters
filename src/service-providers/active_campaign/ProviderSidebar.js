/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withDispatch, withSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { BaseControl, SelectControl, Spinner, TextControl, Notice } from '@wordpress/components';

/**
 * External dependencies
 */
import { pick } from 'lodash';

/**
 * Internal dependencies
 */
import './style.scss';

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
 * @param {Function} props.apiFetch                  Function to fetch data from the API.
 * @param {number}   props.postId                    ID of the edited newsletter post.
 * @param {Function} props.renderCampaignName        Function that renders campaign name input.
 * @param {Function} props.renderSubject             Function that renders email subject input.
 * @param {Function} props.renderPreviewText         Function that renders email preview text input.
 * @param {boolean}  props.inFlight                  True if the component is in a loading state.
 * @param {Object}   props.acData                    ActiveCampaign data.
 * @param {Function} props.updateMetaValue           Dispatcher to update post meta.
 * @param {Object}   props.newsletterData            Newsletter data from the parent components
 * @param {Function} props.createErrorNotice         Dispatcher to display an error message in the editor.
 * @param {string}   props.status                    Current post status.
 * @param {string}   props.stringifiedLayoutDefaults Stringified newsletter data from the layout.
 */
const ProviderSidebarComponent = ( {
	postId,
	apiFetch,
	renderCampaignName,
	renderSubject,
	renderPreviewText,
	inFlight,
	acData,
	updateMetaValue,
	newsletterData,
	createErrorNotice,
	status,
	stringifiedLayoutDefaults,
} ) => {
	const [ lists, setLists ] = useState( [] );
	const [ segments, setSegments ] = useState( [] );

	useEffect( () => {
		fetchListsAndSegments();
	}, [] );

	const fetchListsAndSegments = async () => {
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
		updateMetaValue( 'newsletterData', updatedData );
	}, [ JSON.stringify( acData ), lists, status ] );

	// If there is a stringified newsletter data from the layout, use it to set the list and segments.
	useEffect( () => {
		try {
			const layoutDefaults = JSON.parse( stringifiedLayoutDefaults );
			if ( layoutDefaults && layoutDefaults.newsletterData ) {
				AC_DATA_METADATA_KEYS.forEach( key => {
					const layoutKey = key.replace( 'ac_', '' );
					if ( ! acData[ key ] && layoutDefaults.newsletterData[ layoutKey ] ) {
						updateMetaValue( key, layoutDefaults.newsletterData[ layoutKey ] );
					}
				} );
			}
		} catch ( e ) {
			// Ignore it.
		}
	}, [ stringifiedLayoutDefaults.length ] );

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
				value={ acData.ac_from_name }
				disabled={ inFlight }
				onChange={ value => updateMetaValue( 'ac_from_name', value ) }
			/>
			<TextControl
				label={ __( 'Email', 'newspack-newsletters' ) }
				className="newspack-newsletters__email-textcontrol"
				value={ acData.ac_from_email }
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
					value={ acData.ac_list_id }
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
					disabled={ inFlight }
				/>
				{ acData.ac_list_id && (
					<SelectControl
						label={ __( 'Segment', 'newspack-newsletters' ) }
						value={ acData.ac_segment_id }
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
						disabled={ inFlight }
					/>
				) }
				{ inFlight && <Spinner /> }
			</BaseControl>
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

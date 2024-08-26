/* global newspack_newsletters_data */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { Notice } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import Autocomplete from './autocomplete';
import { useNewsletterData } from '../store';

// The container for list + sublist autocomplete fields.
const SendTo = (
	{
		inFlight,
		fetchSendLists = () => {},
	}
) => {
	const [ error, setError ] = useState( null );
	const { listId, sublistId } = useSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			listId: meta.send_list_id,
			sublistId: meta.send_sublist_id,
		};
	} );
	const editPost = useDispatch( 'core/editor' ).editPost;
	const updateMeta = ( meta ) => editPost( { meta } );

	const newsletterData = useNewsletterData();
	const { lists = [], sublists = [] } = newsletterData;
	const { labels } = newspack_newsletters_data || {};
	const listLabel = labels?.list || __( 'list', 'newspack-newsletters' );
	const sublistLabel = labels?.sublist || __( 'sublist', 'newspack-newsletters' );
	const selectedList = lists.find( item => item.id === listId );
	const selectedSublist = sublists.find( item => item.id === sublistId );

	useEffect( () => {
		if ( sublistId && ! sublists.length ) {
			fetchSendLists(
				{
					ids: sublistId ? [ sublistId ] : null,
					parent_id: listId || null,
					type: 'sublist',
				}
			);
		}
	}, [ sublistId ] );

	const renderSelectedSummary = () => {
		if ( ! selectedList?.name || ( selectedSublist && ! selectedSublist.name ) ) {
			return null;
		}
		let summary;
		if ( selectedList.list && ! selectedSublist?.name ) {
			summary = sprintf(
				// Translators: A summary of which list the campaign is set to send to, and the total number of contacts, if available. %1$s is the number of contacts. %2$s is the label of the list (ex: Main), %3$s is the label for the type of the list (ex: "list" on Active Campaign and "audience" on Mailchimp).
				_n(
					'This newsletter will be sent to <strong>%1$s contact</strong> in the <strong>%2$s</strong> %3$s.',
					'This newsletter will be sent to <strong>all %1$s contacts</strong> in the <strong>%2$s</strong> %3$s.',
					selectedList?.count || 0,
					'newspack-newsletters'
				),
				selectedList?.count ? selectedList.count.toLocaleString() : '',
				selectedList?.name,
				selectedList?.entity_type?.toLowerCase()
		  );
		}
		if ( selectedList && selectedSublist?.name ) {
			summary = sprintf(
				// Translators: A summary of which list the campaign is set to send to, and the total number of contacts, if available. %1$s is the number of contacts. %2$s is the label of the list (ex: Main), %3$s is the label for the type of the list (ex: "list" on Active Campaign and "audience" on Mailchimp).
				_n(
					'This newsletter will be sent to <strong>%1$s contact</strong> in the <strong>%2$s</strong> %3$s who is part of the <strong>%4$s</strong> %5$s.',
					'This newsletter will be sent to <strong>all %1$s contacts</strong> in the <strong>%2$s</strong> %3$s who are part of the <strong>%4$s</strong> %5$s.',
					selectedSublist?.count || 0,
					'newspack-newsletters'
				),
				selectedSublist.count ? selectedSublist.count.toLocaleString() : '',
				selectedList?.name,
				selectedList?.entity_type?.toLowerCase(),
				selectedSublist.name,
				selectedSublist.entity_type?.toLowerCase()
			);
		}

		return (
			<p
				dangerouslySetInnerHTML={ {
					__html: summary,
				} }
			/>
		);
	};

	return (
		<>
			<hr />
			<strong className="newspack-newsletters__label">
				{ __( 'Send to', 'newspack-newsletters' ) }
			</strong>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			{
				( newsletterData?.fetched_list || newsletterData?.fetched_sublist ) && (
					<Notice status="success" isDismissible={ false }>
						{ __( 'Updated send-to info fetched from ESP.', 'newspack-newsletters' ) }
					</Notice>
				)
			}
			<Autocomplete
				availableItems={ lists }
				label={ listLabel }
				inFlight={ inFlight }
				onChange={ selectedLabels => {
					const selectedLabel = selectedLabels[ 0 ];
					const selectedSuggestion = lists.find( item => item.label === selectedLabel );
					if ( ! selectedSuggestion?.id ) {
						return setError(
							sprintf(
								// Translators: Error shown when we can't find info on the selected sublist. %s is the ESP's label for the list entity.
								__( 'Invalid %s selection.', 'newspack-newsletters' ),
								listLabel
							)
						);
					}
					updateMeta( { send_list_id: selectedSuggestion.id } );
				} }
				onFocus={ () => {
					if ( 1 >= lists?.length ) {
						fetchSendLists();
					}
				} }
				onInputChange={ search => search && fetchSendLists( { search } ) }
				reset={ () => {
					updateMeta( { send_list_id: null, send_sublist_id: null } )
				} }
				selectedInfo={ selectedList }
				setError={ setError }
				updateMeta={ updateMeta }
			/>
			{
				selectedList?.id && (
					<Autocomplete
						availableItems={ sublists.filter( item => ! item.parent || selectedList.id === item.parent ) }
						label={ sublistLabel }
						inFlight={ inFlight }
						parentId={ selectedList.id }
						onChange={ selectedLabels => {
							const selectedLabel = selectedLabels[ 0 ];
							const selectedSuggestion = sublists.find( item => item.label === selectedLabel && ( ! item.parent || selectedList.id === item.parent ) );
							if ( ! selectedSuggestion?.id ) {
								return setError(
									sprintf(
										// Translators: Error shown when we can't find info on the selected sublist. %s is the ESP's label for the sublist entity or entities.
										__( 'Invalid %s selection.', 'newspack-newsletters' ),
										sublistLabel
									)
								);
							}
							updateMeta( { send_sublist_id: selectedSuggestion.id } );
						} }
						onFocus={ () => {
							if ( 1 >= sublists?.length ) {
								fetchSendLists( {
									type: 'sublist',
									parentId: selectedList.id
								} );
							}
						} }
						onInputChange={ search => search && fetchSendLists( {
							search,
							type: 'sublist',
							parent_id: selectedList.id
						} ) }
						reset={ () => {
							updateMeta( { send_list_id: selectedList.id, send_sublist_id: null } )
						} }
						selectedInfo={ selectedSublist }
						setError={ setError }
						updateMeta={ updateMeta }
					/>
				)
			}
			{ renderSelectedSummary()}
		</>
	);
};

export default SendTo;
/* global newspack_newsletters_data */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { Notice } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import Autocomplete from './autocomplete';

// The container for list + sublist autocomplete fields.
const SendTo = (
	{
		inFlight = false,
		fetchSendLists = () => {},
		selected = {},
		sendLists = [],
		updateMeta = () => {}
	}
) => {
	const [ error, setError ] = useState( null );
	const { labels } = newspack_newsletters_data || {};
	const lists = sendLists.filter( item => 'list' === item.type );
	const sublists = sendLists.filter( item => 'sublist' === item.type );
	const listLabel = labels?.list || __( 'list', 'newspack-newsletters' );
	const sublistLabel = labels?.sublist || __( 'sublist', 'newspack-newsletters' );

	const renderSelectedSummary = () => {
		if ( ! selected?.list?.name || ( selected?.sublist && ! selected?.sublist?.name ) ) {
			return null;
		}
		let summary;
		if ( selected.list && ! selected.sublist?.name ) {
			summary = sprintf(
				// Translators: A summary of which list the campaign is set to send to, and the total number of contacts, if available. %1$s is the number of contacts. %2$s is the label of the list (ex: Main), %3$s is the label for the type of the list (ex: "list" on Active Campaign and "audience" on Mailchimp).
				_n(
					'This newsletter will be sent to <strong>%1$s contact</strong> in the <strong>%2$s</strong> %3$s.',
					'This newsletter will be sent to <strong>all %1$s contacts</strong> in the <strong>%2$s</strong> %3$s.',
					selected.list?.count || 0,
					'newspack-newsletters'
				),
				selected.list?.count ? selected.list.count.toLocaleString() : '',
				selected.list?.name,
				selected.list?.entity_type?.toLowerCase()
		  );
		}
		if ( selected.list && selected.sublist?.name ) {
			summary = sprintf(
				// Translators: A summary of which list the campaign is set to send to, and the total number of contacts, if available. %1$s is the number of contacts. %2$s is the label of the list (ex: Main), %3$s is the label for the type of the list (ex: "list" on Active Campaign and "audience" on Mailchimp).
				_n(
					'This newsletter will be sent to <strong>%1$s contact</strong> in the <strong>%2$s</strong> %3$s who is part of the <strong>%4$s</strong> %5$s.',
					'This newsletter will be sent to <strong>all %1$s contacts</strong> in the <strong>%2$s</strong> %3$s who are part of the <strong>%4$s</strong> %5$s.',
					selected.sublist?.count || 0,
					'newspack-newsletters'
				),
				selected.sublist.count ? selected.sublist.count.toLocaleString() : '',
				selected.list?.name,
				selected.list?.entity_type?.toLowerCase(),
				selected.sublist.name,
				selected.sublist.entity_type?.toLowerCase()
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
			<Autocomplete
				type="list"
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
					const newSendTo = {}; // When selecting a new list, reset any sublist selection.
					newSendTo.list = selectedSuggestion;
					updateMeta( { send_to: newSendTo } );
				} }
				onFocus={ () => {
					if ( ! lists.length ) {
						fetchSendLists( '', 'list', null, 10 );
					}
				} }
				onInputChange={ search => fetchSendLists( search, 'list' ) }
				reset={ () => {
					updateMeta( { send_to: {} } )
				} }
				selected={ selected }
				setError={ setError }
				updateMeta={ updateMeta }
			/>
			{
				selected?.list?.id && (
					<Autocomplete
						type="sublist"
						availableItems={ sublists.filter( item => selected.list.id === item.parent ) }
						label={ sublistLabel }
						inFlight={ inFlight }
						parentId={ selected.list.id }
						onChange={ selectedLabels => {
							const selectedLabel = selectedLabels[ 0 ];
							const selectedSuggestion = sublists.find( item => item.label === selectedLabel && selected.list.id === item.parent );
							if ( ! selectedSuggestion?.id ) {
								return setError(
									sprintf(
										// Translators: Error shown when we can't find info on the selected sublist. %s is the ESP's label for the sublist entity or entities.
										__( 'Invalid %s selection.', 'newspack-newsletters' ),
										sublistLabel
									)
								);
							}
							const newSendTo = {  ...selected }; // When setting a sublist, retain list selection.
							newSendTo.sublist = selectedSuggestion;
							updateMeta( { send_to: newSendTo } );
						} }
						onFocus={ () => {
							if ( ! sublists.length ) {
								fetchSendLists( '', 'sublist', selected.list.id, 10 );
							}
						} }
						onInputChange={ search => fetchSendLists( search, 'sublist', selected.list.id ) }
						reset={ () => {
							updateMeta( { send_to: { list: selected.list } } )
						} }
						selected={ selected }
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

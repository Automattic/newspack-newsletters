/* global newspack_newsletters_data */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { FormTokenField, Button, ButtonGroup, Notice } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { Icon, external } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { getSuggestionLabel } from '../utils';

// The autocomplete field for lists or sublists.
const Autocomplete = ( {
	availableItems,
	label = '',
	type = 'list' ,
	onChange,
	reset,
	selected,
	inFlight,
} ) => {
	const [ isEditing, setIsEditing ] = useState( false );
	const selectedInfo = selected[ type ] ? availableItems.find( item => item.id === selected[ type ] ) : {};

	if ( selected[ type ] && ! isEditing ) {
		if ( ! selectedInfo?.name ) {
			return (
				<p>
					{
						sprintf(
							// Translators: Message shown while fetching selected list or sublist info.  %s is the provider's label for the given entity type (list or sublist).
							__( 'Retrieving %s info…', 'newspack-newsletters' ),
							label
						)
					}
				</p>
			);
		}
		return (
			<div className="newspack-newsletters__send-to">
				<p className="newspack-newsletters__send-to-details">
					{ selectedInfo.name }
					<span>
						{ selectedInfo.entity_type }
						{ selectedInfo?.hasOwnProperty( 'count' )
							? ' • ' +
							sprintf(
									// Translators: If available, show a contact count alongside the selected item's type. %d is the number of contacts in the item.
									_n( '%d contact', '%d contacts', selectedInfo.count, 'newspack-newsletters' ),
									selectedInfo.count.toLocaleString()
							)
							: '' }
					</span>
				</p>
				<ButtonGroup>
					<Button
						disabled={ inFlight }
						onClick={ () => setIsEditing( true ) }
						size="small"
						variant="secondary"
					>
						{ __( 'Edit', 'newspack-newsletters' ) }
					</Button>
					<Button
						disabled={ inFlight }
						onClick={ reset }
						size="small"
						variant="secondary"
					>
						{ __( 'Clear', 'newspack-newsletters' ) }
					</Button>
					{ selectedInfo?.edit_link && (
						<Button
							disabled={ inFlight }
							href={ selectedInfo.edit_link }
							size="small"
							target="_blank"
							variant="secondary"
							rel="noopener noreferrer"
						>
							{ __( 'Manage', 'newspack-newsletters' ) }
							<Icon icon={ external } size={ 14 } />
						</Button>
					) }
				</ButtonGroup>
			</div>
		);
	}

	return (
		<div className="newspack-newsletters__send-to">
			<FormTokenField
				disabled={ inFlight }
				label={ sprintf(
					// Translators: SendTo autocomplete field label. %s is the provider's label for the given entity type (list or sublist).
					__( 'Select %s', 'newspack-newsletters' ),
					label.toLowerCase()
				) }
				maxSuggestions={ 10 }
				onChange={ selectedLabels => {
					onChange( selectedLabels );
					setIsEditing( false );
				} }
				suggestions={ availableItems.map( item => item.label ) }
				placeholder={ inFlight ? __( 'Fetching…', 'newspack' ) : sprintf(
					// Translators: SendTo autocomplete field placeholder. %s is the provider's label for parent lists.
					__( 'Type %s name to search', 'newspack-newsletters' ),
					label.toLowerCase()
				) }
				value={ [] }
				__experimentalExpandOnFocus={ true }
				__experimentalShowHowTo={ false }
			/>
			{ selected[ type ] && (
				<ButtonGroup>
					<Button
						disabled={ inFlight }
						onClick={ () => setIsEditing( false ) }
						variant="secondary"
						size="small"
					>
						{ __( 'Cancel', 'newspack-newsletters' ) }
					</Button>
				</ButtonGroup>
			) }
		</div>
	);
};

// The container for list + sublist autocomplete fields.
const SendTo = ( { inFlight = false, selected = {}, updateMeta = () => {} } ) => {
	const [ error, setError ] = useState( null );
	const [ selectedList, setSelectedList ] = useState( {} );
	const [ selectedSublist, setSelectedSublist ] = useState( {} );
	const { labels } = newspack_newsletters_data || {};
	const sendLists = ( newspack_newsletters_data?.send_lists || [] ).map( item => {
		return {
			...item,
			value: item.id.toString(),
			label: getSuggestionLabel( item ),
		};
	} );
	const lists = sendLists.filter( item => 'list' === item.type );
	const sublists = sendLists.filter( item => 'sublist' === item.type );
	const listLabel = labels?.list || __( 'list', 'newspack-newsletters' );
	const sublistLabel = labels?.sublist || __( 'sublist', 'newspack-newsletters' );

	useEffect( () => {
		if ( selected?.list ) {
			setSelectedList( lists.find( item => item.id === selected.list ) );
		}
		if ( selected?.sublist ) {
			setSelectedSublist( sublists.find( item => item.id === selected.sublist ) );
		}
	}, [ selected ] );

	const renderSelectedSummary = () => {
		if ( ! selected?.list || ! selectedList?.name || ( selected?.sublist && ! selectedSublist?.name ) ) {
			return null;
		}
		let summary;
		if ( selectedList && ! selectedSublist?.name ) {
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
					setSelectedList( selectedSuggestion );
					const newSendTo = {}; // When selecting a new list, reset any sublist selection.
					newSendTo.list = selectedSuggestion.id;
					updateMeta( { send_to: newSendTo } );
				} }
				reset={ () => {
					setSelectedList( {} );
					updateMeta( { send_to: {} } )
				} }
				selected={ selected }
				setError={ setError }
				updateMeta={ updateMeta }
			/>
			{
				selected?.list && (
					<Autocomplete
						type="sublist"
						availableItems={ sublists.filter( item => selected.list === item.parent ) }
						label={ sublistLabel }
						inFlight={ inFlight }
						parentId={ selected.list }
						onChange={ selectedLabels => {
							const selectedLabel = selectedLabels[ 0 ];
							const selectedSuggestion = sublists.find( item => item.label === selectedLabel && selected.list === item.parent );
							if ( ! selectedSuggestion?.id ) {
								return setError(
									sprintf(
										// Translators: Error shown when we can't find info on the selected sublist. %s is the ESP's label for the sublist entity or entities.
										__( 'Invalid %s selection.', 'newspack-newsletters' ),
										sublistLabel
									)
								);
							}
							setSelectedSublist( selectedSuggestion );
							const newSendTo = {  ...selected }; // When setting a sublist, retain list selection.
							newSendTo.sublist = selectedSuggestion.id;
							updateMeta( { send_to: newSendTo } );
						} }
						reset={ () => {
							setSelectedSublist( {} );
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

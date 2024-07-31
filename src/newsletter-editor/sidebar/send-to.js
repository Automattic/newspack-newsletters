/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { FormTokenField, Button, ButtonGroup, Notice } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { Icon, external } from '@wordpress/icons';

const SendTo = ( { availableItems, formLabel, onChange, placeholder, reset, selectedItem } ) => {
	const [ isEditing, setIsEditing ] = useState( false );
	const [ isUpdating, setIsUpdating ] = useState( false );
	const [ error, setError ] = useState( false );

	return (
		<div className="newspack-newsletters__send-to">
			{ error && ! isEditing && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }

			{ selectedItem && ! isEditing ? (
				<>
					<p className="newspack-newsletters__send-to-details">
						{ selectedItem.name }
						<span>
							{ isUpdating
								? sprintf(
										// Translators: Shown while resetting the selected send-to item. %s is the item type.
										__( 'Resetting %s…', 'newspack-newsletters' ),
										selectedItem.typeLabel.toLowerCase()
								  )
								: selectedItem.typeLabel }
							{ ! isUpdating && selectedItem.hasOwnProperty( 'count' )
								? ' • ' +
								  sprintf(
										// Translators: If available, show a contact count alongside the selected item's type. %d is the number of contacts in the item.
										_n( '%d contact', '%d contacts', selectedItem.count, 'newspack-newsletters' ),
										selectedItem.count.toLocaleString()
								  )
								: '' }
						</span>
					</p>
				</>
			) : (
				<>
					<FormTokenField
						disabled={ isUpdating }
						label={ formLabel || __( 'Select a list', 'newspack' ) }
						maxSuggestions={ 10 }
						onChange={ items => {
							setError( false );
							setIsUpdating( true );
							onChange( items )
								.catch( e => {
									setError( e.message || __( 'Error updating campaign.', 'newspack-newsletters' ) );
								} )
								.finally( () => {
									setIsUpdating( false );
									setIsEditing( false );
								} );
						} }
						suggestions={ availableItems.map( item => item.label ) }
						placeholder={ isUpdating ? __( 'Updating campaign…', 'newspack' ) : placeholder }
						value={ [] }
						__experimentalExpandOnFocus={ true }
						__experimentalShowHowTo={ false }
					/>
				</>
			) }
			{ selectedItem && (
				<ButtonGroup>
					{ ! isEditing && (
						<>
							<Button
								disabled={ isUpdating }
								onClick={ () => setIsEditing( true ) }
								size="small"
								variant="secondary"
							>
								{ __( 'Edit', 'newspack-newsletters' ) }
							</Button>
							{ reset && (
								<Button
									disabled={ isUpdating }
									onClick={ () => {
										setError( false );
										setIsUpdating( true );
										reset()
											.catch( e => {
												setError(
													e.message || __( 'Error updating campaign.', 'newspack-newsletters' )
												);
											} )
											.finally( () => {
												setIsUpdating( false );
												setIsEditing( false );
											} );
									} }
									size="small"
									variant="secondary"
								>
									{ __( 'Reset', 'newspack-newsletters' ) }
								</Button>
							) }
							{ selectedItem.editLink && (
								<Button
									disabled={ isUpdating }
									href={ selectedItem.editLink }
									size="small"
									target="_blank"
									variant="secondary"
									rel="noopener noreferrer"
								>
									{ __( 'Manage', 'newspack-newsletters' ) }
									<Icon icon={ external } size={ 14 } />
								</Button>
							) }
						</>
					) }
					{ isEditing && (
						<Button
							disabled={ isUpdating }
							onClick={ () => setIsEditing( false ) }
							variant="secondary"
							size="small"
						>
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
					) }
				</ButtonGroup>
			) }
		</div>
	);
};

export default SendTo;

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { FormTokenField, Button, ButtonGroup, Notice } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { Icon, external } from '@wordpress/icons';

const SendTo = ( {
	availableLists,
	formLabel,
	getLabel,
	getLink = null,
	onChange,
	placeholder,
	reset,
	selectedList,
} ) => {
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

			{ selectedList && ! isEditing ? (
				<div>
					<p>
						<strong>{ getLabel( selectedList ) }</strong>{ ' ' }
					</p>
				</div>
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
						suggestions={ availableLists.map( suggestion => suggestion.label ) }
						placeholder={ isUpdating ? __( 'Updating campaign…', 'newspack' ) : placeholder }
						value={ [] }
						__experimentalExpandOnFocus={ true }
						__experimentalShowHowTo={ false }
					/>
				</>
			) }
			{ selectedList && (
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
							{ getLink && (
								<Button
									disabled={ isUpdating }
									href={ getLink( selectedList ) }
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
						<Button onClick={ () => setIsEditing( false ) } variant="secondary" size="small">
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
					) }
				</ButtonGroup>
			) }
		</div>
	);
};

export default SendTo;

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { FormTokenField, Button, ButtonGroup, Notice } from '@wordpress/components';
import { useState } from '@wordpress/element';

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
		<>
			{ error && ! isEditing && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }

			{ selectedList && ! isEditing ? (
				<div>
					<p>
						<strong>{ getLabel( selectedList ) }</strong>{ ' ' }
						{ getLink ? getLink( selectedList ) : null }
					</p>
				</div>
			) : (
				<>
					<FormTokenField
						disabled={ isUpdating }
						label={ formLabel || __( 'Select a list', 'newspack' ) }
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
								variant="secondary"
							>
								{ __( 'Edit', 'newspack-newsletters' ) }
							</Button>
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
								variant="secondary"
							>
								{ __( 'Reset', 'newspack-newsletters' ) }
							</Button>
						</>
					) }
					{ isEditing && (
						<Button onClick={ () => setIsEditing( false ) } variant="secondary">
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
					) }
				</ButtonGroup>
			) }
		</>
	);
};

export default SendTo;

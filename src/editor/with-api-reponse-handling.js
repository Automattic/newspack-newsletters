/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { withDispatch } from '@wordpress/data';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useState } from '@wordpress/element';

const withNoticesActions = withDispatch( dispatch => {
	const { createSuccessNotice, createErrorNotice } = dispatch( 'core/notices' );
	return { createSuccessNotice, createErrorNotice };
} );

export default () =>
	createHigherOrderComponent(
		OriginalComponent =>
			withNoticesActions( ( { createSuccessNotice, createErrorNotice, ...props } ) => {
				const [ inFlight, setInFlight ] = useState( false );
				const fetchAPIData = ( apiRequest, { successMessage } = {} ) => {
					setInFlight( true );
					return new Promise( ( resolve, reject ) => {
						apiFetch( apiRequest )
							.then( response => {
								resolve( response );
								if ( successMessage ) {
									createSuccessNotice( successMessage );
								}
								setInFlight( false );
							} )
							.catch( error => {
								const hasTitleAndDetail = error.data && error.data.detail && error.data.title;
								let detail = '';
								if ( hasTitleAndDetail ) {
									detail = error.data.detail;
								}
								if ( error.data && error.data.errors ) {
									detail = error.data.errors
										.reduce( ( errors, singleError ) => {
											return [ ...errors, `${ singleError.field }: ${ singleError.message }` ];
										}, [] )
										.join( ', ' );
								}
								const errorMessage = hasTitleAndDetail
									? `${ error.data.title }: ${ detail }`
									: error.message;
								createErrorNotice( errorMessage );
								reject( errorMessage );
								setInFlight( false );
							} );
					} );
				};

				return (
					<OriginalComponent { ...props } fetchAPIData={ fetchAPIData } inFlight={ inFlight } />
				);
			} ),
		'newspack-newsletters-with-api-response'
	);

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { dispatch, select } from '@wordpress/data';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useState } from '@wordpress/element';

export default () =>
	createHigherOrderComponent(
		OriginalComponent => props => {
			const [ inFlight, setInFlight ] = useState( false );

			const { createSuccessNotice, createErrorNotice, removeNotice } = dispatch( 'core/notices' );
			const { getNotices } = select( 'core/notices' );

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

							const options = {};

							// Special case for fatal errors handling.
							if ( error.code === 'newspack_newsletters_error_fatal' ) {
								options.actions = [
									{
										label: 'Resync',
										onClick: () => {
											// Re-sync with API.
											fetchAPIData( {
												path: `/newspack-newsletters/v1/resync/${ error.data.post_id }`,
											} ).then( resolve );
											// Dismiss all notices.
											getNotices().forEach( notice => removeNotice( notice.id ) );
										},
									},
								];
							} else {
								reject( errorMessage );
							}
							createErrorNotice( errorMessage, options );
							setInFlight( false );
						} );
				} );
			};

			return <OriginalComponent { ...props } fetchAPIData={ fetchAPIData } inFlight={ inFlight } />;
		},
		'newspack-newsletters-with-api-response'
	);

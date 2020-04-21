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
			const apiFetchWithErrorHandling = apiRequest => {
				setInFlight( true );
				return new Promise( ( resolve, reject ) => {
					apiFetch( apiRequest )
						.then( response => {
							const { message } = response;
							if ( message ) {
								getNotices().forEach( notice => removeNotice( notice.id ) );
								createSuccessNotice( message );
							}
							setInFlight( false );
							resolve( response );
						} )
						.catch( error => {
							const { message } = error;
							getNotices().forEach( notice => removeNotice( notice.id ) );
							createErrorNotice( message );
							setInFlight( false );
							reject( error );
						} );
				} );
			};
			return (
				<OriginalComponent
					{ ...props }
					apiFetchWithErrorHandling={ apiFetchWithErrorHandling }
					inFlight={ inFlight }
				/>
			);
		},
		'newspack-newsletters-with-api-response'
	);

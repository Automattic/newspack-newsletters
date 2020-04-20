/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { withDispatch } from '@wordpress/data';
import { createHigherOrderComponent } from '@wordpress/compose';

const withNoticesActions = withDispatch( dispatch => {
	const { createSuccessNotice, createErrorNotice } = dispatch( 'core/notices' );
	return { createSuccessNotice, createErrorNotice };
} );

export default () =>
	createHigherOrderComponent(
		OriginalComponent =>
			withNoticesActions( ( { createSuccessNotice, createErrorNotice, ...props } ) => {
				const fetchAPIData = ( apiRequest, { successMessage } = {} ) => {
					return new Promise( ( resolve, reject ) => {
						apiFetch( apiRequest )
							.then( response => {
								resolve( response );
								if ( successMessage ) {
									createSuccessNotice( successMessage );
								}
							} )
							.catch( error => {
								const hasTitleAndDetail = error.data && error.data.detail && error.data.title;
								const errorMessage = hasTitleAndDetail
									? `${ error.data.title }: ${ error.data.detail }`
									: error.message;
								createErrorNotice( errorMessage );
								reject( errorMessage );
							} );
					} );
				};

				return <OriginalComponent { ...props } fetchAPIData={ fetchAPIData } />;
			} ),
		'newspack-newsletters-with-api-response'
	);

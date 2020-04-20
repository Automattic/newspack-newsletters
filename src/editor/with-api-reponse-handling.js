/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
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
								let errorMessage = hasTitleAndDetail
									? `${ error.data.title }: ${ error.data.detail }`
									: error.message;
								if ( error.code === 'newspack_newsletters_mailchimp_error_fatal' ) {
									const label =
										error.data.type === 'publish'
											? __(
													'There was an error when publishing the campaign',
													'newspack-newsletters'
											  )
											: __(
													'There was an error when synchronizing with Mailchimp',
													'newspack-newsletters'
											  );
									errorMessage = `${ label }: ${ errorMessage }`;
								}
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

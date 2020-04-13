/**
 * WordPress dependencies
 */
import { withSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

export default withSelect( select => {
	const { getEditedPostAttribute } = select( 'core/editor' );
	const meta = getEditedPostAttribute( 'meta' );
	return {
		validationErrors: meta.campaign_validation_errors || [],
	};
} )( ( { validationErrors } ) => {
	if ( validationErrors.length ) {
		return (
			<ul>
				{ validationErrors.map( ( message, index ) => (
					<li key={ index }>{ message }</li>
				) ) }
			</ul>
		);
	}
	return __( 'Newsletter is ready to send', 'newspack-newsletters' );
} );

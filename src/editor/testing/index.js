/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Fragment, useState } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';

export default compose( [
	withSelect( select => {
		const { getCurrentPostId } = select( 'core/editor' );
		return { postId: getCurrentPostId() };
	} ),
	withDispatch( dispatch => {
		const { savePost } = dispatch( 'core/editor' );
		return {
			savePost,
		};
	} ),
] )( ( { postId, savePost } ) => {
	const [ inFlight, setInFlight ] = useState( false );
	const [ testEmail, setTestEmail ] = useState( '' );
	const sendMailchimpTest = async () => {
		setInFlight( true );
		await savePost();
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/test`,
			data: {
				test_email: testEmail,
			},
			method: 'POST',
		};
		apiFetch( params ).then( () => setInFlight( false ) );
	};
	return (
		<Fragment>
			<TextControl
				label={ __( 'Send a test to', 'newspack-newsletters' ) }
				value={ testEmail }
				type="email"
				onChange={ setTestEmail }
				help={ __( 'Use commas to separate multiple emails.', 'newspack-newsletters' ) }
			/>
			<Button isPrimary onClick={ sendMailchimpTest } disabled={ testEmail.length < 1 || inFlight }>
				{ __( 'Send a Test Email', 'newspack-newsletters' ) }
			</Button>
		</Fragment>
	);
} );

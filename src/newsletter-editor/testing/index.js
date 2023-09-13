/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { useState, Fragment } from '@wordpress/element';
import { Button, Spinner, TextControl } from '@wordpress/components';
import { hasValidEmail } from '../utils';

/**
 * Internal dependencies
 */
import withApiHandler from '../../components/with-api-handler';
import './style.scss';

export default compose( [
	withApiHandler(),
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
] )(
	( {
		apiFetchWithErrorHandling,
		inFlight,
		postId,
		savePost,
		setInFlightForAsync,
		testEmail,
		onChangeEmail,
		disabled,
		inlineNotifications,
	} ) => {
		const [ localInFlight, setLocalInFlight ] = useState( false );
		const [ localMessage, setLocalMessage ] = useState( '' );
		const sendTestEmail = async () => {
			const serviceProvider =
				window &&
				window.newspack_newsletters_data &&
				window.newspack_newsletters_data.service_provider;
			if ( inlineNotifications ) {
				setLocalInFlight( true );
			} else {
				setInFlightForAsync();
			}
			await savePost();
			const params = {
				path: `/newspack-newsletters/v1/${ serviceProvider }/${ postId }/test`,
				data: {
					test_email: testEmail,
				},
				method: 'POST',
			};
			if ( inlineNotifications ) {
				apiFetch( params )
					.then( res => {
						setLocalMessage( res?.message || __( 'Test email sent.', 'newspack-newsletters' ) );
					} )
					.catch( err => {
						setLocalMessage(
							err?.message ||
								err?.data?.message ||
								__( 'Error sending test email.', 'newspack-newsletters' )
						);
					} )
					.finally( () => {
						setLocalInFlight( false );
					} );
			} else {
				apiFetchWithErrorHandling( params );
			}
		};
		return (
			<Fragment>
				<TextControl
					label={ __( 'Send a test to', 'newspack-newsletters' ) }
					value={ testEmail }
					type="email"
					onChange={ onChangeEmail }
					disabled={ localInFlight || inFlight }
					help={ __( 'Use commas to separate multiple emails.', 'newspack-newsletters' ) }
				/>
				<div className="newspack-newsletters__testing-controls">
					<Button
						variant="secondary"
						onClick={ sendTestEmail }
						disabled={ disabled || localInFlight || inFlight || ! hasValidEmail( testEmail ) }
					>
						{ inFlight || localInFlight
							? __( 'Sending Test Email…', 'newspack-newsletters' )
							: __( 'Send a Test Email', 'newspack-newsletters' ) }
					</Button>
					{ ( inFlight || localInFlight ) && <Spinner /> }
				</div>
				{ localMessage ? (
					<p className="newspack-newsletters__testing-message">{ localMessage }</p>
				) : null }
			</Fragment>
		);
	}
);

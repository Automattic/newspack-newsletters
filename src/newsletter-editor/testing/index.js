/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { useEffect, useState } from '@wordpress/element';
import {
	Button,
	TextControl,
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
} from '@wordpress/components';
import { hasValidEmail, isLayoutEditor, usePrevious } from '../utils';

/**
 * Internal dependencies
 */
import withApiHandler from '../../components/with-api-handler';
import { useIsRefreshingHtml, useLastRefreshHadError, useNewsletterData } from '../store';
import './style.scss';

const serviceProvider = window && window.newspack_newsletters_data && window.newspack_newsletters_data.service_provider;

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
] )( ( { apiFetchWithErrorHandling, inFlight, postId, savePost, setInFlightForAsync, testEmail, onChangeEmail, disabled, inlineNotifications } ) => {
	const isRefreshingHtml = useIsRefreshingHtml();
	const wasRefreshingHtml = usePrevious( isRefreshingHtml );
	const lastRefreshHadError = useLastRefreshHadError();
	const [ shouldSendTest, setShouldSendTest ] = useState( false );
	const [ localInFlight, setLocalInFlight ] = useState( false );
	const [ localMessage, setLocalMessage ] = useState( '' );
	// `supports_multiple_test_recipients` is a per-provider capability flag
	// that lives on the campaign payload — it's nested under
	// `newsletterData`, not a sibling on the hook's return shape.
	const { newsletterData } = useNewsletterData();
	const supportsMultipleTestEmailRecipients = !! newsletterData?.supports_multiple_test_recipients;

	// Intentionally only on `isRefreshingHtml` — the effect's semantic is
	// "react to a refresh transition", not to changes in any of the other
	// values. Adding them would cause spurious re-runs (every keystroke in
	// the email field changes `shouldSendTest`-adjacent state via siblings,
	// `sendTestEmail` is a fresh closure each render). The closure is
	// recreated each render anyway, so the values it reads are current.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect( () => {
		if ( wasRefreshingHtml && ! isRefreshingHtml && shouldSendTest ) {
			if ( lastRefreshHadError ) {
				// Refresh failed — the user already saw the error notice
				// from MJML; don't send a test against stale/missing HTML.
				// Clear the pending state so the next click re-arms it.
				setShouldSendTest( false );
				setLocalInFlight( false );
				return;
			}
			sendTestEmail();
		}
	}, [ isRefreshingHtml ] );

	const sendTestEmail = async () => {
		// Layouts route through a layout-specific REST endpoint that
		// `wp_mail`s the rendered HTML directly — the per-provider
		// `/test` route is gated by the newsletter-CPT validator and
		// internally calls `sync()` to create an ESP campaign object,
		// neither of which applies to layouts.
		const path = isLayoutEditor()
			? `/newspack-newsletters/v1/layouts/${ postId }/test`
			: `/newspack-newsletters/v1/${ serviceProvider }/${ postId }/test`;
		const params = {
			path,
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
					setLocalMessage( err?.message || err?.data?.message || __( 'Error sending test email.', 'newspack-newsletters' ) );
				} )
				.finally( () => {
					setLocalInFlight( false );
					setShouldSendTest( false );
				} );
		} else {
			await apiFetchWithErrorHandling( params );
			setShouldSendTest( false );
		}
	};

	const triggerSave = async () => {
		if ( inlineNotifications ) {
			setLocalInFlight( true );
		} else {
			setInFlightForAsync();
		}
		await savePost();
		setShouldSendTest( true );
	};

	return (
		<VStack spacing={ 4 }>
			<TextControl
				label={ __( 'Send a test to', 'newspack-newsletters' ) }
				help={
					supportsMultipleTestEmailRecipients
						? __( 'Use commas to separate multiple emails. Any unsaved changes will be saved.', 'newspack-newsletters' )
						: __( 'Any unsaved changes will be saved.', 'newspack-newsletters' )
				}
				value={ testEmail }
				type="email"
				onChange={ onChangeEmail }
				disabled={ localInFlight || inFlight }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<div className="newspack-newsletters__testing-controls">
				<Button
					variant="secondary"
					onClick={ triggerSave }
					isBusy={ inFlight || localInFlight }
					disabled={ disabled || ! hasValidEmail( testEmail ) }
					__next40pxDefaultSize
				>
					{ inFlight || localInFlight
						? __( 'Sending test email…', 'newspack-newsletters' )
						: __( 'Send a test email', 'newspack-newsletters' ) }
				</Button>
			</div>
			{ localMessage ? <p className="newspack-newsletters__testing-message">{ localMessage }</p> : null }
		</VStack>
	);
} );

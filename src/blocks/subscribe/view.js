/* globals newspack_newsletters_subscribe_block */
/**
 * Internal dependencies
 */
import './style.scss';

let nonce;

/**
 * Specify a function to execute when the DOM is fully loaded.
 *
 * @see https://github.com/WordPress/gutenberg/blob/trunk/packages/dom-ready/
 *
 * @param {Function} callback A function to execute after the DOM is ready.
 * @return {void}
 */
function domReady( callback ) {
	if ( typeof document === 'undefined' ) {
		return;
	}
	if (
		document.readyState === 'complete' || // DOMContentLoaded + Images/Styles/etc loaded, so we call directly.
		document.readyState === 'interactive' // DOMContentLoaded fires at this point, so we call directly.
	) {
		return void callback();
	}
	// DOMContentLoaded has not fired yet, delay callback until then.
	document.addEventListener( 'DOMContentLoaded', callback );
}

function getCaptchaToken() {
	return new Promise( ( res, rej ) => {
		const reCaptchaScript = document.getElementById( 'newspack-recaptcha-js' );
		if ( ! reCaptchaScript ) {
			return res( '' );
		}

		const { grecaptcha } = window;
		if ( ! grecaptcha ) {
			return res( '' );
		}

		const captchaSiteKey = reCaptchaScript.getAttribute( 'src' ).split( '?render=' ).pop();

		if ( ! captchaSiteKey ) {
			return res( '' );
		}

		if ( ! grecaptcha?.ready ) {
			rej( newspack_newsletters_subscribe_block.recaptcha_error );
		}

		grecaptcha.ready( () => {
			grecaptcha
				.execute( captchaSiteKey, { action: 'submit' } )
				.then( token => res( token ) )
				.catch( e => rej( e ) );
		} );
	} );
}

domReady( function () {
	document.querySelectorAll( '.newspack-newsletters-subscribe' ).forEach( container => {
		const form = container.querySelector( 'form' );
		if ( ! form ) {
			return;
		}
		const messageContainer = container.querySelector( '.newspack-newsletters-subscribe__message' );
		const emailInput = container.querySelector( 'input[type="email"]' );
		const submit = container.querySelector( 'input[type="submit"]' );

		form.onSubmit = ( status = 200 ) => {
			container.setAttribute( 'data-status', status );
			// Add success message.
			const messageNode = document.createElement( 'p' );
			messageNode.innerHTML = container.getAttribute( 'data-success-message' );
			messageNode.className = `message status-${ status }`;
			messageContainer.appendChild( messageNode );
			// Hide the form.
			form.style.display = 'none';
		};

		form.onError = ( message, status = 400 ) => {
			container.setAttribute( 'data-status', status );
			// Clear any previous messages.
			messageContainer.innerHTML = '';
			// Add error message.
			const messageNode = document.createElement( 'p' );
			messageNode.innerHTML = message;
			messageNode.className = `message status-${ status }`;
			messageContainer.appendChild( messageNode );
			// Re-enable the form.
			emailInput.removeAttribute( 'disabled' );
			submit.removeAttribute( 'disabled' );
			form.style.display = 'initial';
		};

		form.addEventListener( 'submit', ev => {
			ev.preventDefault();
			messageContainer.innerHTML = '';
			submit.disabled = true;

			if ( ! form.npe?.value ) {
				return form.onError( newspack_newsletters_subscribe_block.invalid_email );
			}

			getCaptchaToken()
				.then( captchaToken => {
					if ( ! captchaToken ) {
						return;
					}
					let tokenField = form.captcha_token;
					if ( ! tokenField ) {
						tokenField = document.createElement( 'input' );
						tokenField.setAttribute( 'type', 'hidden' );
						tokenField.setAttribute( 'name', 'captcha_token' );
						tokenField.setAttribute( 'autocomplete', 'off' );
						form.appendChild( tokenField );
					}
					tokenField.value = captchaToken;
				} )
				.catch( e => {
					form.onError( e );
				} )
				.finally( () => {
					const body = new FormData( form );
					if ( ! body.has( 'npe' ) || ! body.get( 'npe' ) ) {
						return form.onError( newspack_newsletters_subscribe_block.invalid_email );
					}
					if ( nonce ) {
						body.set( 'newspack_newsletters_subscribe', nonce );
					}
					emailInput.setAttribute( 'disabled', 'true' );
					submit.setAttribute( 'disabled', 'true' );

					form.onSubmit();

					fetch( form.getAttribute( 'action' ) || window.location.pathname, {
						method: 'POST',
						headers: {
							Accept: 'application/json',
						},
						body,
					} ).then( res => {
						res
							.json()
							.then(
								( {
									message,
									newspack_newsletters_subscribed: wasSubscribed,
									newspack_newsletters_subscribe,
								} ) => {
									nonce = newspack_newsletters_subscribe;
									if ( ! wasSubscribed ) {
										form.onError( message, res.status );
									}
								}
							);
					} );
				} );
		} );
	} );
} );

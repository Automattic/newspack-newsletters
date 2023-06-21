/* globals newspack_newsletters_subscribe_block */
/**
 * Internal dependencies
 */
import './style.scss';

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
		const responseContainer = container.querySelector(
			'.newspack-newsletters-subscribe__response'
		);
		const messageContainer = container.querySelector( '.newspack-newsletters-subscribe__message' );
		const emailInput = container.querySelector( 'input[type="email"]' );
		const submit = container.querySelector( 'input[type="submit"]' );
		form.endFlow = ( message, status = 500, wasSubscribed = false ) => {
			container.setAttribute( 'data-status', status );
			const messageNode = document.createElement( 'p' );
			emailInput.removeAttribute( 'disabled' );
			submit.removeAttribute( 'disabled' );
			messageNode.innerHTML = wasSubscribed
				? container.getAttribute( 'data-success-message' )
				: message;
			messageContainer.appendChild( messageNode );
			messageNode.className = `message status-${ status }`;
			if ( status === 200 ) {
				container.replaceChild( responseContainer, form );
			}
		};
		form.addEventListener( 'submit', ev => {
			ev.preventDefault();
			messageContainer.innerHTML = '';
			submit.disabled = true;

			if ( ! form.npe?.value ) {
				return form.endFlow( newspack_newsletters_subscribe_block.invalid_email, 400 );
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
					form.endFlow( e, 400 );
				} )
				.finally( () => {
					const body = new FormData( form );
					if ( ! body.has( 'npe' ) || ! body.get( 'npe' ) ) {
						return form.endFlow( newspack_newsletters_subscribe_block.invalid_email, 400 );
					}
					emailInput.setAttribute( 'disabled', 'true' );
					submit.setAttribute( 'disabled', 'true' );

					fetch( form.getAttribute( 'action' ) || window.location.pathname, {
						method: 'POST',
						headers: {
							Accept: 'application/json',
						},
						body,
					} ).then( res => {
						res.json().then( ( { message, newspack_newsletters_subscribed: wasSubscribed } ) => {
							form.endFlow( message, res.status, wasSubscribed );
						} );
					} );
				} );
		} );
	} );
} );

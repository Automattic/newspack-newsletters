/* globals newspack_newsletters_subscribe_block, newspack_grecaptcha */
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
		form.setLoading = ( isLoading = true ) => {
			if ( isLoading ) {
				form.classList.add( 'loading' );
				emailInput.setAttribute( 'disabled', 'true' );
				submit.setAttribute( 'disabled', 'true' );
			} else {
				form.classList.remove( 'loading' );
				emailInput.removeAttribute( 'disabled' );
				submit.removeAttribute( 'disabled' );
			}
		};
		form.endFlow = ( message, status = 500, wasSubscribed = false ) => {
			container.setAttribute( 'data-status', status );
			const messageNode = document.createElement( 'p' );
			form.setLoading( false );
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
			if ( ! form.npe?.value ) {
				return form.endFlow( newspack_newsletters_subscribe_block.invalid_email, 400 );
			}

			const getCaptchaToken = newspack_grecaptcha
				? newspack_grecaptcha?.getCaptchaToken
				: () => new Promise( res => res( '' ) ); // Empty promise.

			getCaptchaToken( form )
				.then( captchaToken => {
					if ( ! captchaToken ) {
						return;
					}
					let tokenField = form[ 'g-recaptcha-response' ];
					if ( ! tokenField ) {
						tokenField = document.createElement( 'input' );
						tokenField.setAttribute( 'type', 'hidden' );
						tokenField.setAttribute( 'name', 'g-recaptcha-response' );
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
					if ( nonce ) {
						body.set( 'newspack_newsletters_subscribe', nonce );
					}
					form.setLoading();

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
									form.endFlow( message, res.status, wasSubscribed );
								}
							);
					} );
				} );
		} );
	} );
} );

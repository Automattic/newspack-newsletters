/**
 * Internal dependencies
 */
import './style.scss';

( function () {
	window.onload = function () {
		[ ...document.querySelectorAll( '.newspack-newsletters-subscribe' ) ].forEach( container => {
			const form = container.querySelector( 'form' );
			if ( ! form ) {
				return;
			}
			const messageContainer = container.querySelector(
				'.newspack-newsletters-subscribe-response'
			);
			const submit = container.querySelector( 'input[type="submit"]' );
			form.addEventListener( 'submit', ev => {
				ev.preventDefault();
				const body = new FormData( form );
				if ( ! body.has( 'email' ) || ! body.get( 'email' ) ) {
					return;
				}
				submit.disabled = true;
				messageContainer.innerHTML = '';
				fetch( form.getAttribute( 'action' ) || window.location.pathname, {
					method: 'POST',
					headers: {
						Accept: 'application/json',
					},
					body,
				} ).then( res => {
					submit.disabled = false;
					res.json().then( ( { message } ) => {
						const messageNode = document.createElement( 'p' );
						messageNode.innerHTML = message;
						messageNode.className = `message status-${ res.status }`;
						if ( res.status === 200 ) {
							container.replaceChild( messageNode, form );
						} else {
							messageContainer.appendChild( messageNode );
						}
					} );
				} );
			} );
		} );
	};
} )();

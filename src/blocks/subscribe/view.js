/**
 * Internal dependencies
 */
import './style.scss';

( function () {
	[ ...document.querySelectorAll( '.newspack-newsletters-subscribe' ) ].forEach( container => {
		const form = container.querySelector( 'form' );
		if ( ! form ) {
			return;
		}
		const messageContainer = container.querySelector( '.newspack-newsletters-subscribe-response' );
		messageContainer.style.display = 'none';
		form.addEventListener( 'submit', ev => {
			ev.preventDefault();
			const body = new FormData( form );
			if ( ! body.has( 'email' ) || ! body.get( 'email' ) ) {
				return;
			}
			fetch( form.getAttribute( 'action' ) || window.location.pathname, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
				},
				body,
			} ).then( res => {
				res.json().then( ( { message } ) => {
					const messageNode = document.createElement( 'p' );
					messageNode.innerHTML = message;
					messageNode.className = `message status-${ res.status }`;
					if ( res.status === 200 ) {
						container.replaceChild( messageNode, form );
					} else {
						messageContainer.innerHTML = '';
						messageContainer.appendChild( messageNode );
						messageContainer.style.display = 'block';
					}
				} );
			} );
		} );
	} );
} )();

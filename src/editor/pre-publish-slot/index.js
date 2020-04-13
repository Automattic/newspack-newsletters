/**
 * WordPress dependencies
 */
import { Spinner } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { withSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export default withSelect( select => {
	const { getCurrentPostId } = select( 'core/editor' );
	return { postId: getCurrentPostId() };
} )( props => {
	const [ campaign, setCampaign ] = useState();
	useEffect(() => {
		const { postId } = props;
		apiFetch( { path: `/newspack-newsletters/v1/mailchimp/${ postId }` } ).then( result =>
			setCampaign( result.campaign )
		);
	}, []);
	if ( ! campaign ) {
		return [ __( 'Retrieving Mailchimp data', 'newspack-newsletters' ), <Spinner key="spinner" /> ];
	}
	const { recipients, settings, status } = campaign;
	const { list_id: listId } = recipients;
	const { from_name: senderName, reply_to: senderEmail } = settings;
	const messages = [];
	if ( 'sent' === status || 'sending' === status ) {
		messages.push( __( 'Newsletter has already been sent', 'newspack-newsletters' ) );
	}
	if ( ! listId ) {
		messages.push(
			__( 'A Mailchimp list must be selected before publishing.', 'newspack-newsletters' )
		);
	}
	if ( ! senderName || senderName.length < 1 ) {
		messages.push( __( 'Sender name must be set.', 'newspack-newsletters' ) );
	}
	if ( ! senderEmail || senderEmail.length < 1 ) {
		messages.push( __( 'Sender email must be set.', 'newspack-newsletters' ) );
	}
	if ( messages.length ) {
		return (
			<ul>
				{ messages.map( ( message, index ) => (
					<li key={ index }>{ message }</li>
				) ) }
			</ul>
		);
	}
	return __( 'Newsletter is ready to send', 'newspack-newsletters' );
} );

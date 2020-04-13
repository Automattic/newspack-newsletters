/**
 * WordPress dependencies
 */
import { compose } from '@wordpress/compose';
import apiFetch from '@wordpress/api-fetch';
import { withDispatch, withSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

export default compose( [
	withDispatch( dispatch => {
		const { lockPostSaving, unlockPostSaving } = dispatch( 'core/editor' );
		return { lockPostSaving, unlockPostSaving };
	} ),
	withSelect( select => {
		const { getCurrentPostId } = select( 'core/editor' );
		return { postId: getCurrentPostId() };
	} ),
] )( props => {
	const [ campaign, setCampaign ] = useState();
	useEffect( () => {
		const { postId } = props;
		apiFetch( { path: `/newspack-newsletters/v1/mailchimp/${ postId }` } ).then( result =>
			setCampaign( result.campaign )
		);
	} );
	const { recipients, status } = campaign || {};
	const { list_id: listId } = recipients || {};

	if ( 'sent' === status || 'sending' === status ) {
		return __( 'Newsletter has already been sent', 'newspack-newsletters' );
	}
	if ( ! listId ) {
		return __( 'A Mailchimp list must be selected before publishing.', 'newspack-newsletters' );
	}
	return __( 'Newsletter is ready to send', 'newspack-newsletters' );
} );

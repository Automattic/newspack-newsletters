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
	const [ listId, setListId ] = useState( [] );
	useEffect( () => {
		const { postId } = props;
		apiFetch( { path: `/newspack-newsletters/v1/mailchimp/${ postId }` } ).then( result => {
			const { campaign } = result;
			const { recipients } = campaign || {};
			const { list_id } = recipients;
			setListId( list_id );
		} );
	} );
	return ! listId ? __( 'Select a Mailchimp list to publish', 'newspack-newsletters' ) : null;
} );

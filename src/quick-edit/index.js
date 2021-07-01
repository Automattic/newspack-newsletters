const jQuery = window && window.jQuery;

if ( 'undefined' !== typeof inlineEditPost ) {
	// eslint-disable-next-line no-undef
	const wp_inline_edit_function = inlineEditPost.edit;

	// eslint-disable-next-line no-undef
	inlineEditPost.edit = function( post_id ) {
		wp_inline_edit_function.apply( this, arguments );

		let id = 0;
		if ( typeof post_id === 'object' ) {
			id = parseInt( this.getId( post_id ) );
		}

		if ( id > 0 ) {
			if ( jQuery( `tr#post-${ id } .is_public` ).text() ) {
				jQuery( `tr#edit-${ id } :input[name="switch_public_page"]` ).prop( 'checked', true );
			}
		}
	};
}

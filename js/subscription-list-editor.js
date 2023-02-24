jQuery( document ).ready( function ( $ ) {
	$( '#menu-posts-newspack_nl_cpt' )
		.addClass( 'wp-has-current-submenu wp-menu-open menu-top menu-top-first' )
		.removeClass( 'wp-not-current-submenu' );
	$( '#menu-posts-newspack_nl_cpt > a' )
		.addClass( 'wp-has-current-submenu' )
		.removeClass( 'wp-not-current-submenu' );
	$( 'a[href$="edit.php?post_type=newspack_nl_list"]' )
		.addClass( 'current' )
		.parent()
		.addClass( 'current' );
} );

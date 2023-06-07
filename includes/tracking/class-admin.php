<?php
/**
 * Newspack Newsletters Tracking Admin UI Tweaks.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Tracking;

/**
 * Tracking Data Events Class.
 */
final class Admin {
	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'manage_' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_posts_columns', [ __CLASS__, 'manage_columns' ] );
		add_action( 'manage_' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_posts_custom_column', [ __CLASS__, 'custom_column' ], 10, 2 );
	}

	/**
	 * Manage columns.
	 *
	 * @param array $columns Columns.
	 */
	public static function manage_columns( $columns ) {
		$columns['opened'] = __( 'Opened', 'newspack-newsletters' );
		return $columns;
	}

	/**
	 * Custom column content.
	 *
	 * @param array $column_name Column name.
	 * @param int   $post_id     Post ID.
	 */
	public static function custom_column( $column_name, $post_id ) {
		if ( 'opened' !== $column_name ) {
			return;
		}
		echo intval( get_post_meta( $post_id, 'newspack_newsletters_tracking_pixel_seen', true ) );
	}
}
Admin::init();

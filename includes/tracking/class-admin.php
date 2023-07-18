<?php
/**
 * Newspack Newsletters Tracking Admin UI Tweaks.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Tracking;

/**
 * Tracking Admin Class.
 */
final class Admin {
	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'manage_' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_posts_columns', [ __CLASS__, 'manage_columns' ] );
		add_action( 'manage_' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_posts_custom_column', [ __CLASS__, 'custom_column' ], 10, 2 );
		add_action( 'manage_edit-' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_sortable_columns', [ __CLASS__, 'sortable_columns' ] );
		add_action( 'pre_get_posts', [ __CLASS__, 'handle_sorting' ] );
	}

	/**
	 * Manage columns.
	 *
	 * @param array $columns Columns.
	 */
	public static function manage_columns( $columns ) {
		$columns['opened'] = __( 'Opened', 'newspack-newsletters' );
		$columns['clicks'] = __( 'Clicks', 'newspack-newsletters' );
		return $columns;
	}

	/**
	 * Custom column content.
	 *
	 * @param array $column_name Column name.
	 * @param int   $post_id     Post ID.
	 */
	public static function custom_column( $column_name, $post_id ) {
		if ( 'opened' === $column_name ) {
			echo intval( get_post_meta( $post_id, 'newspack_newsletters_tracking_pixel_seen', true ) );
		} elseif ( 'clicks' === $column_name ) {
			echo intval( get_post_meta( $post_id, 'tracking_clicks', true ) );
		}
	}

	/**
	 * Sortable columns.
	 *
	 * @param array $columns Columns.
	 */
	public static function sortable_columns( $columns ) {
		$columns['opened'] = 'opened';
		$columns['clicks'] = 'clicks';
		return $columns;
	}

	/**
	 * Handle sorting.
	 *
	 * @param \WP_Query $query Query.
	 */
	public static function handle_sorting( $query ) {
		if ( ! is_admin() || ! $query->is_main_query() ) {
			return;
		}
		if ( \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT !== $query->get( 'post_type' ) ) {
			return;
		}

		$orderby = $query->get( 'orderby' );
		if ( 'opened' === $orderby ) {
			$query->set( 'meta_key', 'newspack_newsletters_tracking_pixel_seen' );
			$query->set( 'orderby', 'meta_value_num' );
		} elseif ( 'clicks' === $orderby ) {
			$query->set( 'meta_key', 'tracking_clicks' );
			$query->set( 'orderby', 'meta_value_num' );
		}
	}
}
Admin::init();

<?php
/**
 * Newspack Newsletters Subscription Lists
 *
 * @package Newspack
 */

namespace Newspack\Newsletters;

use Newspack_Newsletters;

defined( 'ABSPATH' ) || exit;

/**
 * Main Newspack Newsletters Subscription Lists class.
 *
 * Subscriptions Lists are Lists which readers can subscribe to. AKA Newsletters.
 *
 * Each List is associated with a Audience/List in the Provider and can be associated to one or more tags in the provider
 */
class Subscription_Lists {

	/**
	 * CPT for Newsletter Lists.
	 */
	const NEWSPACK_NEWSLETTERS_LIST_CPT = 'newspack_nl_list';

	/**
	 * Initialize this class and register hooks
	 *
	 * @return void
	 */
	public static function init() {
		if ( ! self::should_initialize_lists() ) {
			return;
		}
		add_action( 'init', [ __CLASS__, 'register_post_type' ] );
		add_action( 'admin_menu', [ __CLASS__, 'add_submenu_item' ] );
		add_filter( 'wp_editor_settings', [ __CLASS__, 'filter_editor_settings' ], 10, 2 );
	}

	/**
	 * Check if we should initialize the Subscription lists
	 *
	 * @return boolean
	 */
	public static function should_initialize_lists() {
		// We only need this on admin.
		if ( ! is_admin() ) {
			return false;
		}
		
		// If Service Provider is not configured yet.
		if ( 'manual' === Newspack_Newsletters::service_provider() || ! Newspack_Newsletters::is_service_provider_configured() ) {
			return false;
		}

		$provider = Newspack_Newsletters::get_service_provider();

		// Only init if current provider supports tags.
		return $provider::$support_tags;

	}

	/**
	 * Disable Rich text editing from the editor
	 *
	 * @param array  $settings The settings to be filtered.
	 * @param string $editor_id The editor identifier.
	 * @return array
	 */
	public static function filter_editor_settings( $settings, $editor_id ) {
		if ( 'content' === $editor_id && get_current_screen()->post_type === self::NEWSPACK_NEWSLETTERS_LIST_CPT ) {
			$settings['tinymce']       = false;
			$settings['quicktags']     = false;
			$settings['media_buttons'] = false;
		}
	
		return $settings;
	}

	/**
	 * Add Submenu item for Lists
	 */
	public static function add_submenu_item() {
		add_submenu_page(
			'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			__( 'Lists', 'newspack-newsletters' ),
			__( 'Lists', 'newspack-newsletters' ),
			'edit_others_posts',
			'/edit.php?post_type=' . self::NEWSPACK_NEWSLETTERS_LIST_CPT,
			null,
			2
		);
	}

	/**
	 * Register the custom post type
	 *
	 * @return void
	 */
	public static function register_post_type() {

		$labels = array(
			'name'                  => _x( 'Lists', 'Post Type General Name', 'newspack' ),
			'singular_name'         => _x( 'List', 'Post Type Singular Name', 'newspack' ),
			'menu_name'             => __( 'Lists', 'newspack' ),
			'name_admin_bar'        => __( 'Lists', 'newspack' ),
			'archives'              => __( 'LIsts', 'newspack' ),
			'attributes'            => __( 'Lists', 'newspack' ),
			'parent_item_colon'     => __( 'Parent List', 'newspack' ),
			'all_items'             => __( 'All Lists', 'newspack' ),
			'add_new_item'          => __( 'Add new list', 'newspack' ),
			'add_new'               => __( 'Add New', 'newspack' ),
			'new_item'              => __( 'New List', 'newspack' ),
			'edit_item'             => __( 'Edit list', 'newspack' ),
			'update_item'           => __( 'Update list', 'newspack' ),
			'view_item'             => __( 'View list', 'newspack' ),
			'view_items'            => __( 'View Lists', 'newspack' ),
			'search_items'          => __( 'Search List', 'newspack' ),
			'not_found'             => __( 'Not found', 'newspack' ),
			'not_found_in_trash'    => __( 'Not found in Trash', 'newspack' ),
			'featured_image'        => __( 'Featured Image', 'newspack' ),
			'set_featured_image'    => __( 'Set featured image', 'newspack' ),
			'remove_featured_image' => __( 'Remove featured image', 'newspack' ),
			'use_featured_image'    => __( 'Use as featured image', 'newspack' ),
			'insert_into_item'      => __( 'Insert into item', 'newspack' ),
			'uploaded_to_this_item' => __( 'Uploaded to this item', 'newspack' ),
			'items_list'            => __( 'Items list', 'newspack' ),
			'items_list_navigation' => __( 'Items list navigation', 'newspack' ),
			'filter_items_list'     => __( 'Filter items list', 'newspack' ),
		);
		$args   = array(
			'label'            => __( 'List', 'newspack' ),
			'description'      => __( 'Newsletter list', 'newspack' ),
			'labels'           => $labels,
			'supports'         => array( 'title', 'editor' ),
			'hierarchical'     => false,
			'public'           => false,
			'show_ui'          => true,
			'show_in_menu'     => false,
			'can_export'       => false,
			'capability_type'  => 'page',
			'show_in_rest'     => false,
			'delete_with_user' => false,
		);
		register_post_type( self::NEWSPACK_NEWSLETTERS_LIST_CPT, $args );
	}
}

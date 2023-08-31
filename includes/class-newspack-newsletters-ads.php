<?php
/**
 * Newspack Newsletter Ads
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Newspack Newsletters Ads Class.
 */
final class Newspack_Newsletters_Ads {

	const CPT = 'newspack_nl_ads_cpt';

	const ADVERTISER_TAX = 'newspack_nl_advertiser';

	/**
	 * The single instance of the class.
	 *
	 * @var Newspack_Newsletters
	 */
	protected static $instance = null;

	/**
	 * Main Newspack Newsletter Ads Instance.
	 * Ensures only one instance of Newspack Ads Instance is loaded or can be loaded.
	 *
	 * @return Newspack Ads Instance - Main instance.
	 */
	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'init', [ __CLASS__, 'register_ads_cpt' ] );
		add_action( 'init', [ __CLASS__, 'register_meta' ] );
		add_action( 'init', [ __CLASS__, 'register_newsletter_meta' ] );
		add_action( 'save_post_' . self::CPT, [ __CLASS__, 'ad_default_fields' ], 10, 3 );
		add_action( 'admin_menu', [ __CLASS__, 'add_ads_page' ] );
		add_filter( 'get_post_metadata', [ __CLASS__, 'migrate_diable_ads' ], 10, 4 );
		add_action( 'newspack_newsletters_tracking_pixel_seen', [ __CLASS__, 'track_ad_impression' ], 10, 2 );

		// Columns.
		add_action( 'manage_' . self::CPT . '_posts_columns', [ __CLASS__, 'manage_columns' ] );
		add_action( 'manage_' . self::CPT . '_posts_custom_column', [ __CLASS__, 'custom_column' ], 10, 2 );
		add_action( 'manage_edit-' . self::CPT . '_sortable_columns', [ __CLASS__, 'sortable_columns' ] );
		// Sorting.
		add_action( 'pre_get_posts', [ __CLASS__, 'handle_sorting' ] );
	}

	/**
	 * Register custom fields.
	 */
	public static function register_meta() {
		\register_meta(
			'post',
			'start_date',
			[
				'object_subtype' => self::CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'expiry_date',
			[
				'object_subtype' => self::CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'price',
			[
				'object_subtype' => self::CPT,
				'show_in_rest'   => true,
				'type'           => 'number',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'position_in_content',
			[
				'object_subtype' => self::CPT,
				'show_in_rest'   => true,
				'type'           => 'integer',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
	}

	/**
	 * Register custom fields for newsletters.
	 */
	public static function register_newsletter_meta() {
		\register_meta(
			'post',
			'disable_auto_ads',
			[
				'object_subtype' => Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => true,
				'type'           => 'boolean',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
	}

	/**
	 * Add ads page link.
	 */
	public static function add_ads_page() {
		add_submenu_page(
			'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			__( 'Newsletters Ads', 'newspack-newsletters' ),
			__( 'Ads', 'newspack-newsletters' ),
			'edit_others_posts',
			'/edit.php?post_type=' . self::CPT,
			null,
			2
		);
	}

	/**
	 * Register the custom post type for layouts.
	 */
	public static function register_ads_cpt() {
		if ( ! current_user_can( 'edit_others_posts' ) ) {
			return;
		}

		$labels = [
			'name'                     => _x( 'Newsletter Ads', 'post type general name', 'newspack-newsletters' ),
			'singular_name'            => _x( 'Newsletter Ad', 'post type singular name', 'newspack-newsletters' ),
			'menu_name'                => _x( 'Newsletter Ads', 'admin menu', 'newspack-newsletters' ),
			'name_admin_bar'           => _x( 'Newsletter Ad', 'add new on admin bar', 'newspack-newsletters' ),
			'add_new'                  => _x( 'Add New', 'popup', 'newspack-newsletters' ),
			'add_new_item'             => __( 'Add New Newsletter Ad', 'newspack-newsletters' ),
			'new_item'                 => __( 'New Newsletter Ad', 'newspack-newsletters' ),
			'edit_item'                => __( 'Edit Newsletter Ad', 'newspack-newsletters' ),
			'view_item'                => __( 'View Newsletter Ad', 'newspack-newsletters' ),
			'all_items'                => __( 'All Newsletter Ads', 'newspack-newsletters' ),
			'search_items'             => __( 'Search Newsletter Ads', 'newspack-newsletters' ),
			'parent_item_colon'        => __( 'Parent Newsletter Ads:', 'newspack-newsletters' ),
			'not_found'                => __( 'No Newsletter Ads found.', 'newspack-newsletters' ),
			'not_found_in_trash'       => __( 'No Newsletter Ads found in Trash.', 'newspack-newsletters' ),
			'items_list'               => __( 'Newsletter Ads list', 'newspack-newsletters' ),
			'item_published'           => __( 'Newsletter Ad published', 'newspack-newsletters' ),
			'item_published_privately' => __( 'Newsletter Ad published privately', 'newspack-newsletters' ),
			'item_reverted_to_draft'   => __( 'Newsletter Ad reverted to draft', 'newspack-newsletters' ),
			'item_scheduled'           => __( 'Newsletter Ad scheduled', 'newspack-newsletters' ),
			'item_updated'             => __( 'Newsletter Ad updated', 'newspack-newsletters' ),
		];

		$cpt_args = [
			'public'       => false,
			'labels'       => $labels,
			'show_ui'      => true,
			'show_in_menu' => false,
			'show_in_rest' => true,
			'supports'     => [ 'editor', 'title', 'custom-fields' ],
			'taxonomies'   => [ 'category' ],
		];
		register_post_type( self::CPT, $cpt_args );

		register_taxonomy(
			self::ADVERTISER_TAX,
			[ self::CPT, Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT ],
			[
				'labels'            => [
					'name'                     => __( 'Advertisers', 'newspack-newsletters' ),
					'singular_name'            => __( 'Advertiser', 'newspack-newsletters' ),
					'search_items'             => __( 'Search Advertisers', 'newspack-newsletters' ),
					'popular_items'            => __( 'Popular Advertisers', 'newspack-newsletters' ),
					'all_items'                => __( 'All Advertisers', 'newspack-newsletters' ),
					'parent_items'             => __( 'Parent Advertisers', 'newspack-newsletters' ),
					'parent_item'              => __( 'Parent Advertiser', 'newspack-newsletters' ),
					'name_field_description'   => __( 'The advertiser name', 'newspack-newsletters' ),
					'slug_field_description'   => '', // There's no advertiser URL so let's skip slug field description.
					'parent_field_description' => __( 'Assign a parent advertiser', 'newspack-newsletters' ),
					'desc_field_description'   => __( 'Optional description for this advertiser', 'newspack-newsletters' ),
					'edit_item'                => __( 'Edit Advertiser', 'newspack-newsletters' ),
					'view_item'                => __( 'View Advertiser', 'newspack-newsletters' ),
					'update_item'              => __( 'Update Advertiser', 'newspack-newsletters' ),
					'add_new_item'             => __( 'Add New Advertiser', 'newspack-newsletters' ),
					'new_item_name'            => __( 'New Advertiser Name', 'newspack-newsletters' ),
					'not_found'                => __( 'No advertisers found', 'newspack-newsletters' ),
					'no_terms'                 => __( 'No advertisers', 'newspack-newsletters' ),
					'filter_by_item'           => __( 'Filter by advertiser', 'newspack-newsletters' ),
				],
				'description'       => __( 'Newspack Newsletters Ads Advertisers', 'newspack-newsletters' ),
				'public'            => true,
				'hierarchical'      => true,
				'show_in_rest'      => true,
				'show_admin_column' => true,
			]
		);
	}

	/**
	 * Set default fields when Ad is created.
	 *
	 * @param int     $post_id ID of post being saved.
	 * @param WP_POST $post The post being saved.
	 * @param bool    $update True if this is an update, false if a newly created post.
	 */
	public static function ad_default_fields( $post_id, $post, $update ) {
		// Set meta only if this is a newly created post.
		if ( $update ) {
			return;
		}
		update_post_meta( $post_id, 'position_in_content', 100 );
	}

	/**
	 * Migrate 'diable_ads' meta.
	 *
	 * @param mixed  $value   The value get_metadata() should return - a single
	 *                        metadata value, or an array of values. Default null.
	 * @param int    $post_id Post ID.
	 * @param string $key     Meta key.
	 * @param bool   $single  Whether to return only the first value of the specified $key.
	 */
	public static function migrate_diable_ads( $value, $post_id, $key, $single ) {
		if ( 'disable_auto_ads' !== $key ) {
			return $value;
		}
		remove_filter( 'get_post_metadata', [ __CLASS__, 'migrate_diable_ads' ], 10, 4 );
		if ( get_post_meta( $post_id, 'diable_ads', true ) ) {
			delete_post_meta( $post_id, 'diable_ads' );
			update_post_meta( $post_id, 'disable_auto_ads', true );
			$value = true;
			if ( ! $single ) {
				$value = [ $value ];
			}
		}
		add_filter( 'get_post_metadata', [ __CLASS__, 'migrate_diable_ads' ], 10, 4 );
		return $value;
	}

	/**
	 * Whether to render ads in the newsletter
	 *
	 * @param int $post_id ID of the newsletter post.
	 */
	public static function should_render_ads( $post_id ) {
		$should_render_ads = true;

		/**
		 * Disable automated ads insertion.
		 */
		if ( get_post_meta( $post_id, 'disable_auto_ads', true ) ) {
			$should_render_ads = false;
		}

		/**
		 * Filters whether to render ads in the newsletter.
		 *
		 * @param bool $should_render_ads Whether to render ads in the newsletter.
		 * @param int  $post_id           ID of the newsletter post.
		 */
		return apply_filters( 'newspack_newsletters_should_render_ads', $should_render_ads, $post_id );
	}

	/**
	 * Track ad impression.
	 *
	 * @param int    $newsletter_id Newsletter ID.
	 * @param string $email_address Email address.
	 */
	public static function track_ad_impression( $newsletter_id, $email_address ) {
		$inserted_ads = get_post_meta( $newsletter_id, 'inserted_ads', true );
		if ( empty( $inserted_ads ) ) {
			return;
		}
		foreach ( $inserted_ads as $ad_id ) {
			$impressions = get_post_meta( $ad_id, 'tracking_impressions', true );
			if ( ! $impressions ) {
				$impressions = 0;
			}
			$impressions++;
			update_post_meta( $ad_id, 'tracking_impressions', $impressions );

			/**
			 * Fires when an ad impression is tracked.
			 *
			 * @param int    $ad_id         Ad ID.
			 * @param int    $newsletter_id Newsletter ID.
			 * @param string $email_address Email address.
			 */
			do_action( 'newspack_newsletters_tracking_ad_impression', $ad_id, $newsletter_id, $email_address );
		}
	}

	/**
	 * Manage ads columns.
	 *
	 * @param array $columns Columns.
	 */
	public static function manage_columns( $columns ) {
		$columns['start_date']  = __( 'Start Date', 'newspack-newsletters' );
		$columns['expiry_date'] = __( 'Expiration Date', 'newspack-newsletters' );
		$columns['price']       = __( 'Price', 'newspack-newsletters' );
		unset( $columns['date'] );
		unset( $columns['stats'] );
		return $columns;
	}

	/**
	 * Custom ads column content.
	 *
	 * @param array $column_name Column name.
	 * @param int   $post_id     Post ID.
	 */
	public static function custom_column( $column_name, $post_id ) {
		if ( 'start_date' === $column_name ) {
			$start_date = get_post_meta( $post_id, 'start_date', true );
			if ( ! empty( $start_date ) ) {
				echo esc_html( wp_date( get_option( 'date_format' ), strtotime( $start_date ) ) );
			} else {
				echo '—';
			}
		} elseif ( 'expiry_date' === $column_name ) {
			$expiry_date = get_post_meta( $post_id, 'expiry_date', true );
			if ( ! empty( $expiry_date ) ) {
				echo esc_html( wp_date( get_option( 'date_format' ), strtotime( $expiry_date ) ) );
			} else {
				echo '—';
			}
		} elseif ( 'price' === $column_name ) {
			echo floatval( get_post_meta( $post_id, 'price', true ) );
		}
	}

	/**
	 * Sortable columns.
	 *
	 * @param array $columns Columns.
	 */
	public static function sortable_columns( $columns ) {
		$columns['start_date']  = 'start_date';
		$columns['expiry_date'] = 'expiry_date';
		$columns['price']       = 'price';
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
		if ( self::CPT === $query->get( 'post_type' ) ) {
			$orderby = $query->get( 'orderby' );
			if ( 'price' === $orderby ) {
				$query->set( 'meta_key', 'price' );
				$query->set( 'orderby', 'meta_value_num' );
			} elseif ( 'start_date' === $orderby ) {
				$query->set( 'meta_key', 'start_date' );
				$query->set( 'orderby', 'meta_value' );
			} elseif ( 'expiry_date' === $orderby ) {
				$query->set( 'meta_key', 'expiry_date' );
				$query->set( 'orderby', 'meta_value' );
			}
		}
	}
}
Newspack_Newsletters_Ads::instance();

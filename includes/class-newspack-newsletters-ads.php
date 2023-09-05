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
	/**
	 * CPT for Newsletter ads.
	 */
	const NEWSPACK_NEWSLETTERS_ADS_CPT = 'newspack_nl_ads_cpt';

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
		add_action( 'rest_api_init', [ __CLASS__, 'rest_api_init' ] );
		add_action( 'save_post_' . self::NEWSPACK_NEWSLETTERS_ADS_CPT, [ __CLASS__, 'ad_default_fields' ], 10, 3 );
		add_action( 'admin_menu', [ __CLASS__, 'add_ads_page' ] );
		add_filter( 'get_post_metadata', [ __CLASS__, 'migrate_diable_ads' ], 10, 4 );
		add_action( 'newspack_newsletters_tracking_pixel_seen', [ __CLASS__, 'track_ad_impression' ], 10, 2 );
	}

	/**
	 * API endpoints.
	 */
	public static function rest_api_init() {
		\register_rest_route(
			'wp/v2/' . self::NEWSPACK_NEWSLETTERS_ADS_CPT,
			'config',
			[
				'callback'            => [ __CLASS__, 'get_ads_config' ],
				'methods'             => 'GET',
				'permission_callback' => [ __CLASS__, 'permission_callback' ],
			]
		);
	}

	/**
	 * Check capabilities for using the API for authoring tasks.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return bool|WP_Error
	 */
	public static function permission_callback( $request ) {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Register custom fields.
	 */
	public static function register_meta() {
		\register_meta(
			'post',
			'expiry_date',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_ADS_CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'position_in_content',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_ADS_CPT,
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
			'/edit.php?post_type=' . self::NEWSPACK_NEWSLETTERS_ADS_CPT,
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
			'taxonomies'   => [],
		];
		\register_post_type( self::NEWSPACK_NEWSLETTERS_ADS_CPT, $cpt_args );
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
		 * Disable automated ads insertion meta.
		 */
		if ( get_post_meta( $post_id, 'disable_auto_ads', true ) ) {
			$should_render_ads = false;
		}

		/**
		 * Disable automated ads insertion if the newsletter contains a manual ad block.
		 */
		if ( has_block( 'newspack-newsletters/ad', $post_id ) ) {
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
	 * Get properties required to render a useful modal in the editor that alerts
	 * users of ads they're sending.
	 *
	 * @param WP_REST_REQUEST $request The WP Request Object.
	 * @return array
	 */
	public static function get_ads_config( $request ) {
		$letterhead                 = new Newspack_Newsletters_Letterhead();
		$has_letterhead_credentials = $letterhead->has_api_credentials();
		$post_date                  = $request->get_param( 'date' );
		$newspack_ad_type           = self::NEWSPACK_NEWSLETTERS_ADS_CPT;

		$url_to_manage_promotions   = 'https://app.tryletterhead.com/promotions';
		$url_to_manage_newspack_ads = "/wp-admin/edit.php?post_type={$newspack_ad_type}";

		$ads                   = Newspack_Newsletters_Renderer::get_ads( $post_date, 0 );
		$ads_label             = $has_letterhead_credentials ? __( 'promotion', 'newspack-newsletters' ) : __( 'ad', 'newspack-newsletters' );
		$ads_manage_url        = $has_letterhead_credentials ? $url_to_manage_promotions : $url_to_manage_newspack_ads;
		$ads_manage_url_rel    = $has_letterhead_credentials ? 'noreferrer' : '';
		$ads_manage_url_target = $has_letterhead_credentials ? '_blank' : '_self';

		return [
			'count'           => count( $ads ),
			'label'           => $ads_label,
			'manageUrl'       => $ads_manage_url,
			'manageUrlRel'    => $ads_manage_url_rel,
			'manageUrlTarget' => $ads_manage_url_target,
			'ads'             => $ads,
		];
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
}
Newspack_Newsletters_Ads::instance();

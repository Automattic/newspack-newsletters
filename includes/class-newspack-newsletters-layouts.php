<?php
/**
 * Newspack Newsletter Layouts
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Main Newspack Newsletters Class.
 */
final class Newspack_Newsletters_Layouts {
	/**
	 * CPT for Newsletter layouts.
	 * Name if funky because of 20 character restriction.
	 */
	const NEWSPACK_NEWSLETTERS_LAYOUT_CPT = 'newspack_nl_layo_cpt';

	/**
	 * The single instance of the class.
	 *
	 * @var Newspack_Newsletters
	 */
	protected static $instance = null;

	/**
	 * Main Newspack Newsletter Layout Instance.
	 * Ensures only one instance of Newspack Layout Instance is loaded or can be loaded.
	 *
	 * @return Newspack Layout Instance - Main instance.
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
		add_action( 'init', [ __CLASS__, 'register_layout_cpt' ] );
		add_action( 'init', [ __CLASS__, 'register_meta' ] );
		add_action( 'admin_menu', [ __CLASS__, 'add_layouts_link' ] );
	}

	/**
	 * Add options page
	 */
	public static function add_layouts_link() {
		add_submenu_page(
			'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			__( 'Newsletters Layouts', 'newspack-newsletters' ),
			__( 'Layouts', 'newspack-newsletters' ),
			'manage_options',
			'edit.php?post_type=' . self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT
		);
	}

	/**
	 * Register custom fields.
	 */
	public static function register_meta() {
		\register_meta(
			'post',
			'newspack_newsletters_is_default_layout',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
	}

	/**
	 * Register the custom post type for layouts.
	 */
	public static function register_layout_cpt() {
		if ( ! current_user_can( 'edit_others_posts' ) ) {
			return;
		}
		$labels = [
			'name'               => _x( 'Newsletter Layouts', 'post type general name', 'newspack-newsletters' ),
			'singular_name'      => _x( 'Newsletter Layout', 'post type singular name', 'newspack-newsletters' ),
			'menu_name'          => _x( 'Newsletter Layouts', 'admin menu', 'newspack-newsletters' ),
			'name_admin_bar'     => _x( 'Newsletter Layout', 'add new on admin bar', 'newspack-newsletters' ),
			'add_new'            => _x( 'Add New Layout', 'popup', 'newspack-newsletters' ),
			'add_new_item'       => __( 'Add New Newsletter Layout', 'newspack-newsletters' ),
			'new_item'           => __( 'New Newsletter Layout', 'newspack-newsletters' ),
			'edit_item'          => __( 'Edit Newsletter Layout', 'newspack-newsletters' ),
			'view_item'          => __( 'View Newsletter Layout', 'newspack-newsletters' ),
			'all_items'          => __( 'All Newsletter Layouts', 'newspack-newsletters' ),
			'search_items'       => __( 'Search Newsletter Layouts', 'newspack-newsletters' ),
			'parent_item_colon'  => __( 'Parent Newsletter Layouts:', 'newspack-newsletters' ),
			'not_found'          => __( 'No newsletter layouts found.', 'newspack-newsletters' ),
			'not_found_in_trash' => __( 'No newsletter layouts found in Trash.', 'newspack-newsletters' ),
		];

		$cpt_args = [
			'labels'       => $labels,
			'public'       => false,
			'show_in_menu' => false,
			'show_ui'      => true,
			'show_in_rest' => true,
			'supports'     => [ 'editor', 'title', 'custom-fields' ],
			'taxonomies'   => [],
		];
		\register_post_type( self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT, $cpt_args );
	}

	/**
	 * Token replacement for newsletter templates.
	 *
	 * @param string $content Template content.
	 * @param array  $extra Associative array of additional tokens to replace.
	 * @return string Content.
	 */
	public static function template_token_replacement( $content, $extra = [] ) {
		$sitename       = get_bloginfo( 'name' );
		$custom_logo_id = get_theme_mod( 'custom_logo' );
		$logo           = $custom_logo_id ? wp_get_attachment_image_src( $custom_logo_id, 'medium' )[0] : null;

		$sitename_block = sprintf(
			'<!-- wp:heading {"align":"center","level":1} --><h1 class="has-text-align-center">%s</h1><!-- /wp:heading -->',
			$sitename
		);

		$logo_block = $logo ? sprintf(
			'<!-- wp:image {"align":"center","id":%s,"sizeSlug":"medium"} --><figure class="wp-block-image aligncenter size-medium"><img src="%s" alt="%s" class="wp-image-%s" /></figure><!-- /wp:image -->',
			$custom_logo_id,
			$logo,
			$sitename,
			$custom_logo_id
		) : null;

		$search  = array_merge(
			[
				'__SITENAME__',
				'__LOGO__',
				'__LOGO_OR_SITENAME__',
			],
			array_keys( $extra )
		);
		$replace = array_merge(
			[
				$sitename,
				$logo,
				$logo ? $logo_block : $sitename_block,
			],
			array_values( $extra )
		);
		return str_replace( $search, $replace, $content );
	}

	/**
	 * Insert default layouts.
	 */
	public static function insert_default_layout_posts() {
		$default_layout_posts = get_posts(
			array(
				'numberposts' => -1,
				'post_type'   => self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'meta_key'    => 'newspack_newsletters_is_default_layout',
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
				'meta_value'  => 'yes',
			)
		);

		$layout_templates_base_path = NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'includes/templates/';
		foreach ( scandir( $layout_templates_base_path ) as $template ) {
			if ( strpos( $template, '.json' ) !== false ) {
				$decoded_template  = json_decode( file_get_contents( $layout_templates_base_path . $template, true ) ); //phpcs:ignore

				// If there is no layout with such title, add it.
				$existing_layout_template_post = array_filter(
					$default_layout_posts,
					function ( $e ) use ( $decoded_template ) {
						return $e->post_title == $decoded_template->title;
					}
				);

				if ( ! $existing_layout_template_post ) {
					wp_insert_post(
						array(
							'post_type'    => self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
							'post_title'   => $decoded_template->title,
							'meta_input'   => array(
								'newspack_newsletters_is_default_layout' => 'yes',
							),
							'post_status'  => 'publish',
							'post_content' => self::template_token_replacement( $decoded_template->content ),
						)
					);
				}
			}
		}
	}
}
Newspack_Newsletters_Layouts::instance();

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
	 * Name is funky because of 20 character restriction.
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
	}

	/**
	 * Register the custom post type for layouts.
	 */
	public static function register_layout_cpt() {
		if ( ! current_user_can( 'edit_others_posts' ) ) {
			return;
		}

		$cpt_args = [
			'public'       => false,
			'show_in_rest' => true,
			'supports'     => [ 'editor', 'title', 'custom-fields' ],
			'taxonomies'   => [],
		];
		\register_post_type( self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT, $cpt_args );
	}

	/**
	 * Register custom fields.
	 */
	public static function register_meta() {
		\register_meta(
			'post',
			'font_header',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'font_body',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'background_color',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'custom_css',
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
	 * Token replacement for newsletter layouts.
	 *
	 * @param string $content Layout content.
	 * @param array  $extra Associative array of additional tokens to replace.
	 * @return string Content.
	 */
	public static function layout_token_replacement( $content, $extra = [] ) {
		$home_url       = get_home_url();
		$sitename       = get_bloginfo( 'name' );
		$custom_logo_id = get_theme_mod( 'custom_logo' );
		$logo           = $custom_logo_id ? wp_get_attachment_image_src( $custom_logo_id, 'medium' )[0] : null;
		$date           = gmdate( get_option( 'date_format' ) );
		$bg_color       = '#ffffff';
		$text_color     = '#000000';

		// Check if current theme is a Newspack teme.
		if ( function_exists( 'newspack_setup' ) ) {
			$solid_bg          = get_theme_mod( 'header_solid_background' );
			$header_status     = get_theme_mod( 'header_color' );
			$primary_color_hex = get_theme_mod( 'primary_color_hex' );
			$header_color_hex  = get_theme_mod( 'header_color_hex' );
			$header_color      = 'default' === $header_status ? $primary_color_hex : $header_color_hex;
			$bg_color          = $solid_bg ? $header_color : '#ffffff';
			$text_color        = newspack_get_color_contrast( $bg_color );
		}

		$sitename_block = sprintf(
			'<!-- wp:heading {"level":1} --><h1 id="%s"><a href="%s">%s</a></h1><!-- /wp:heading -->',
			sanitize_title_with_dashes( $sitename ),
			esc_url( $home_url ),
			$sitename
		);

		$sitename_block_small = sprintf(
			'<!-- wp:heading {"level":4} --><h4 id="%s"><a href="%s">%s</a></h4><!-- /wp:heading -->',
			sanitize_title_with_dashes( $sitename ),
			esc_url( $home_url ),
			$sitename
		);

		$logo_block = $logo ? sprintf(
			'<!-- wp:image {"align":"center","id":%s,"sizeSlug":"medium"} --><figure class="wp-block-image aligncenter size-medium"><img src="%s" alt="%s" class="wp-image-%s" /></figure><!-- /wp:image -->',
			$custom_logo_id,
			$logo,
			$sitename,
			$custom_logo_id
		) : null;

		$date_block = sprintf(
			'<!-- wp:paragraph --><p>%s</p><!-- /wp:paragraph -->',
			$date
		);

		$date_block_right = sprintf(
			'<!-- wp:paragraph {"align":"right"} --><p class="has-text-align-right">%s</p><!-- /wp:paragraph -->',
			$date
		);

		$date_block_center = sprintf(
			'<!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">%s</p><!-- /wp:paragraph -->',
			$date
		);

		$search  = array_merge(
			[
				'__SITENAME__',
				'__SITENAME_SMALL__',
				'__LOGO__',
				'__LOGO_OR_SITENAME__',
				'__DATE__',
				'__DATE_RIGHT__',
				'__DATE_CENTER__',
				'__BG_COLOR__',
				'__TEXT_COLOR__',
			],
			array_keys( $extra )
		);
		$replace = array_merge(
			[
				$sitename ? $sitename_block : null,
				$sitename ? $sitename_block_small : null,
				$logo ? $logo_block : null,
				$logo ? $logo_block : ( $sitename ? $sitename_block : null ),
				$date_block,
				$date_block_right,
				$date_block_center,
				$bg_color,
				$text_color,
			],
			array_values( $extra )
		);
		return str_replace( $search, $replace, $content );
	}

	/**
	 * Get default layouts.
	 */
	public static function get_default_layouts() {
		$layouts_base_path = NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'includes/layouts/';
		$layouts           = [];
		// 1-indexed, because 0 denotes a blank layout.
		$layout_id = 1;
		foreach ( scandir( $layouts_base_path ) as $layout ) {
			if ( strpos( $layout, '.json' ) !== false ) {
				$decoded_layout  = json_decode( file_get_contents( $layouts_base_path . $layout, true ) ); //phpcs:ignore
				$layouts[]      = array(
					'ID'           => $layout_id,
					'post_title'   => $decoded_layout->title,
					'post_content' => self::layout_token_replacement( $decoded_layout->content ),
				);
				$layout_id++;
			}
		}
		return $layouts;
	}
}
Newspack_Newsletters_Layouts::instance();

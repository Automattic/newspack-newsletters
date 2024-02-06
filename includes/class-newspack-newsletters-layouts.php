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
		$date               = gmdate( get_option( 'date_format' ) );
		$bg_color           = '#ffffff';
		$text_color         = '#000000';
		$social_links_color = 'black';

		// Check if service provider is Mailchimp.
		if ( 'mailchimp' === Newspack_Newsletters::service_provider() ) {
			$date = '*|DATE:' . get_option( 'date_format' ) . '|*';
		}

		// Check if current theme is a Newspack teme.
		if ( function_exists( 'newspack_setup' ) ) {
			$solid_bg           = get_theme_mod( 'header_solid_background' );
			$header_status      = get_theme_mod( 'header_color' );
			$primary_color_hex  = get_theme_mod( 'primary_color_hex' );
			$header_color_hex   = get_theme_mod( 'header_color_hex' );
			$header_color       = 'default' === $header_status ? $primary_color_hex : $header_color_hex;
			$bg_color           = $solid_bg ? $header_color : '#ffffff';
			$text_color         = newspack_get_color_contrast( $bg_color );
			$social_links_color = '#fff' === $text_color ? 'white' : 'black';
		}

		$sitename_block = '<!-- wp:site-title {"newsletterVisibility":"email"} /-->';

		$sitename_block_center = '<!-- wp:site-title {"textAlign":"center","newsletterVisibility":"email"} /-->';

		$logo_block = '<!-- wp:site-logo {"width":192,"newsletterVisibility":"email"} /-->';

		$logo_block_center = '<!-- wp:site-logo {"align":"center","width":192,"newsletterVisibility":"email"} /-->';

		$date_block = sprintf(
			'<!-- wp:paragraph --><p>%s</p><!-- /wp:paragraph -->',
			$date
		);

		$date_block_right = sprintf(
			'<!-- wp:paragraph {"align":"right","newsletterVisibility":"email"} --><p class="has-text-align-right">%s</p><!-- /wp:paragraph -->',
			$date
		);

		$date_block_center = sprintf(
			'<!-- wp:paragraph {"align":"center","newsletterVisibility":"email"} --><p class="has-text-align-center">%s</p><!-- /wp:paragraph -->',
			$date
		);

		$social_links_block = '<!-- wp:social-links {"newsletterVisibility":"email","className":"is-style-filled-' . $social_links_color . '","layout":{"type":"flex","justifyContent":"right"}} --><ul class="wp-block-social-links is-style-filled-' . $social_links_color . '"><!-- wp:social-link {"url":"#","service":"facebook"} /--><!-- wp:social-link {"url":"#","service":"twitter"} /--><!-- wp:social-link {"url":"#","service":"instagram"} /--><!-- wp:social-link {"url":"#","service":"youtube"} /--></ul><!-- /wp:social-links -->';

		$search = array_merge(
			[
				'__LOGO_OR_SITENAME__',
				'__LOGO_OR_SITENAME_CENTER__',
				'__DATE__',
				'__DATE_RIGHT__',
				'__DATE_CENTER__',
				'__SOCIAL_LINKS__',
				'__BG_COLOR__',
				'__TEXT_COLOR__',
			],
			array_keys( $extra )
		);

		$replace = array_merge(
			[
				has_custom_logo() ? $logo_block : $sitename_block,
				has_custom_logo() ? $logo_block_center : $sitename_block_center,
				$date_block,
				$date_block_right,
				$date_block_center,
				$social_links_block,
				'#ffffff' === $bg_color ? '#fafafa' : $bg_color,
				'#ffffff' === $bg_color ? '#000000' : $text_color,
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
				$title          = '';
				if ( property_exists( $decoded_layout, 'title' ) ) {
					$title = $decoded_layout->title;
				}
				$layouts[] = array(
					'ID'           => $layout_id,
					'post_title'   => $title,
					'post_content' => self::layout_token_replacement( $decoded_layout->content ),
				);
				$layout_id++;
			}
		}
		return $layouts;
	}
}
Newspack_Newsletters_Layouts::instance();

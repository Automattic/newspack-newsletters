<?php
/**
 * Newspack Newsletter Author
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/vendor/autoload.php';

use \DrewM\MailChimp\MailChimp;

/**
 * Main Newspack Popups Class.
 */
final class Newspack_Newsletters {

	const NEWSPACK_NEWSLETTERS_CPT = 'newspack_nl_cpt';

	/**
	 * The single instance of the class.
	 *
	 * @var Newspack_Popups
	 */
	protected static $instance = null;

	/**
	 * Main Newspack Newsletter Author Instance.
	 * Ensures only one instance of Newspack Author Instance is loaded or can be loaded.
	 *
	 * @return Newspack Author Instance - Main instance.
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
		add_action( 'init', [ __CLASS__, 'register_cpt' ] );
		add_action( 'init', [ __CLASS__, 'register_meta' ] );
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'enqueue_block_editor_assets' ] );
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'disable_gradients' ] );
		add_action( 'rest_api_init', [ __CLASS__, 'rest_api_init' ] );
		add_action( 'default_title', [ __CLASS__, 'default_title' ], 10, 2 );
		add_action( 'save_post_' . self::NEWSPACK_NEWSLETTERS_CPT, [ __CLASS__, 'sync_with_mailchimp' ], 10, 3 );
		add_action( 'publish_' . self::NEWSPACK_NEWSLETTERS_CPT, [ __CLASS__, 'send_campaign' ], 10, 2 );
		add_filter( 'allowed_block_types', [ __CLASS__, 'newsletters_allowed_block_types' ], 10, 2 );
		include_once dirname( __FILE__ ) . '/class-newspack-newsletters-settings.php';
		include_once dirname( __FILE__ ) . '/class-newspack-newsletters-renderer.php';
	}

	/**
	 * Register the custom post type.
	 */
	public static function register_cpt() {
		$labels = [
			'name'               => _x( 'Newsletters', 'post type general name', 'newspack-newsletters' ),
			'singular_name'      => _x( 'Newsletter', 'post type singular name', 'newspack-newsletters' ),
			'menu_name'          => _x( 'Newsletters', 'admin menu', 'newspack-newsletters' ),
			'name_admin_bar'     => _x( 'Newsletter', 'add new on admin bar', 'newspack-newsletters' ),
			'add_new'            => _x( 'Add New', 'popup', 'newspack-newsletters' ),
			'add_new_item'       => __( 'Add New Newsletter', 'newspack-newsletters' ),
			'new_item'           => __( 'New Newsletter', 'newspack-newsletters' ),
			'edit_item'          => __( 'Edit Newsletter', 'newspack-newsletters' ),
			'view_item'          => __( 'View Newsletter', 'newspack-newsletters' ),
			'all_items'          => __( 'All Newsletters', 'newspack-newsletters' ),
			'search_items'       => __( 'Search Newsletters', 'newspack-newsletters' ),
			'parent_item_colon'  => __( 'Parent Newsletters:', 'newspack-newsletters' ),
			'not_found'          => __( 'No newsletters found.', 'newspack-newsletters' ),
			'not_found_in_trash' => __( 'No newsletters found in Trash.', 'newspack-newsletters' ),
		];

		$cpt_args = [
			'labels'       => $labels,
			'public'       => false,
			'show_ui'      => true,
			'show_in_rest' => true,
			'supports'     => [ 'editor', 'title', 'custom-fields' ],
			'taxonomies'   => [],
			'menu_icon'    => 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0Ij48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMGg1di0yaC01Yy00LjM0IDAtOC0zLjY2LTgtOHMzLjY2LTggOC04IDggMy42NiA4IDh2MS40M2MwIC43OS0uNzEgMS41Ny0xLjUgMS41N3MtMS41LS43OC0xLjUtMS41N1YxMmMwLTIuNzYtMi4yNC01LTUtNXMtNSAyLjI0LTUgNSAyLjI0IDUgNSA1YzEuMzggMCAyLjY0LS41NiAzLjU0LTEuNDcuNjUuODkgMS43NyAxLjQ3IDIuOTYgMS40NyAxLjk3IDAgMy41LTEuNiAzLjUtMy41N1YxMmMwLTUuNTItNC40OC0xMC0xMC0xMHptMCAxM2MtMS42NiAwLTMtMS4zNC0zLTNzMS4zNC0zIDMtMyAzIDEuMzQgMyAzLTEuMzQgMy0zIDN6IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPgo=',
		];
		\register_post_type( self::NEWSPACK_NEWSLETTERS_CPT, $cpt_args );
	}

	/**
	 * Restrict block types for Newsletter CPT.
	 *
	 * @param array   $allowed_block_types default block types.
	 * @param WP_Post $post the post to consider.
	 */
	public static function newsletters_allowed_block_types( $allowed_block_types, $post ) {
		if ( self::NEWSPACK_NEWSLETTERS_CPT !== $post->post_type ) {
			return $allowed_block_types;
		}
		return array(
			'core/group',
			'core/paragraph',
			'core/heading',
			'core/column',
			'core/columns',
			'core/buttons',
			'core/image',
			'core/separator',
			'core/list',
			'core/quote',
			'core/social-links',
		);
	}

	/**
	 * Load up common JS/CSS for wizards.
	 */
	public static function enqueue_block_editor_assets() {
		$screen = get_current_screen();
		if ( self::NEWSPACK_NEWSLETTERS_CPT !== $screen->post_type ) {
			return;
		}

		\wp_enqueue_script(
			'newspack-newsletters',
			plugins_url( '../dist/editor.js', __FILE__ ),
			[ 'wp-components' ],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/dist/editor.js' ),
			true
		);

		wp_localize_script(
			'newspack-newsletters',
			'newspack_newsletters_data',
			[
				'templates' => self::get_newsletter_templates(),
			]
		);

		wp_register_style(
			'newspack-newsletters',
			plugins_url( '../dist/editor.css', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/dist/editor.css' )
		);
		wp_style_add_data( 'newspack-newsletters', 'rtl', 'replace' );
		wp_enqueue_style( 'newspack-newsletters' );
	}

	/**
	 * Add newspack_popups_is_sitewide_default to Popup object.
	 */
	public static function rest_api_init() {
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'api_mailchimp_data' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id' => [
						'sanitize_callback' => 'absint',
					],
				],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)/test',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_test_mailchimp_campaign' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'         => [
						'sanitize_callback' => 'absint',
					],
					'test_email' => [
						'sanitize_callback' => 'sanitize_email',
					],
				],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)/list/(?P<list_id>[\a-z]+)',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_set_mailchimp_list' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'      => [
						'sanitize_callback' => 'absint',
					],
					'list_id' => [
						'sanitize_callback' => 'esc_attr',
					],
				],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)/settings',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_set_campaign_settings' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'        => [
						'sanitize_callback' => 'absint',
					],
					'from_name' => [
						'sanitize_callback' => 'sanitize_text_field',
					],
					'reply_to'  => [
						'sanitize_callback' => 'sanitize_email',
					],
				],
			]
		);
	}

	/**
	 * Update Campaign settings.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_set_campaign_settings( $request ) {
		$id        = $request['id'];
		$from_name = $request['from_name'];
		$reply_to  = $request['reply_to'];

		if ( self::NEWSPACK_NEWSLETTERS_CPT !== get_post_type( $id ) ) {
			return new WP_Error(
				'newspack_newsletters_incorrect_post_type',
				__( 'Post is not a Newsletter.', 'newspack-newsletters' )
			);
		}

		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		$mc = new Mailchimp( self::mailchimp_api_key() );

		$settings = [];
		if ( $from_name ) {
			$settings['from_name'] = $from_name;
		}
		if ( $reply_to ) {
			$settings['reply_to'] = $reply_to;
		}
		$payload = [
			'settings' => $settings,
		];
		$result  = $mc->patch( "campaigns/$mc_campaign_id", $payload );

		$data           = self::retrieve_data( $id );
		$data['result'] = $result;

		return \rest_ensure_response( $data );
	}

	/**
	 * Set Mailchimp list.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_set_mailchimp_list( $request ) {
		$id      = $request['id'];
		$list_id = $request['list_id'];

		if ( self::NEWSPACK_NEWSLETTERS_CPT !== get_post_type( $id ) ) {
			return new WP_Error(
				'newspack_newsletters_incorrect_post_type',
				__( 'Post is not a Newsletter.', 'newspack-newsletters' )
			);
		}


		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		$mc      = new Mailchimp( self::mailchimp_api_key() );
		$payload = [
			'recipients' => [
				'list_id' => $list_id,
			],
		];
		$result  = $mc->patch( "campaigns/$mc_campaign_id", $payload );

		$data           = self::retrieve_data( $id );
		$data['result'] = $result;

		return \rest_ensure_response( $data );
	}

	/**
	 * Register custom fields.
	 */
	public static function register_meta() {
		\register_meta(
			'post',
			'mc_campaign_id',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'mc_list_id',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
	}

	/**
	 * Get Mailchimp data.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_mailchimp_data( $request ) {
		return \rest_ensure_response( self::retrieve_data( $request['id'] ) );
	}

	/**
	 * Send a test email via Mailchimp.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_test_mailchimp_campaign( $request ) {
		$id         = $request['id'];
		$test_email = $request['test_email'];
		if ( self::NEWSPACK_NEWSLETTERS_CPT !== get_post_type( $id ) ) {
			return new WP_Error(
				'newspack_newsletters_incorrect_post_type',
				__( 'Post is not a Newsletter.', 'newspack-newsletters' )
			);
		}


		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		$mc      = new Mailchimp( self::mailchimp_api_key() );
		$payload = [
			'test_emails' => [
				$test_email,
			],
			'send_type'   => 'html',
		];
		$result  = $mc->post( "campaigns/$mc_campaign_id/actions/test", $payload );

		$data           = self::retrieve_data( $id );
		$data['result'] = $result;

		return \rest_ensure_response( $data );
	}

	/**
	 * Send the Mailchimp campaign.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_send_mailchimp_campaign( $request ) {
		$id           = $request['id'];
		$sender_name  = $request['sender_name'];
		$sender_email = $request['sender_email'];
		if ( self::NEWSPACK_NEWSLETTERS_CPT !== get_post_type( $id ) ) {
			return new WP_Error(
				'newspack_newsletters_incorrect_post_type',
				__( 'Post is not a Newsletter.', 'newspack-newsletters' )
			);
		}


		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		$mc = new Mailchimp( self::mailchimp_api_key() );

		$payload = [
			'settings' => [
				'from_name' => $sender_name,
				'reply_to'  => $sender_email,
			],
		];
		$mc->patch( "campaigns/$mc_campaign_id", $payload );

		$payload = [
			'send_type' => 'html',
		];
		$result  = $mc->post( "campaigns/$mc_campaign_id/actions/send", $payload );

		$data           = self::retrieve_data( $id );
		$data['result'] = $result;

		return \rest_ensure_response( $data );
	}

	/**
	 * Get Mailchimp data.
	 *
	 * @param string $id post ID.
	 */
	public static function retrieve_data( $id ) {
		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		$mc             = new Mailchimp( self::mailchimp_api_key() );
		return [
			'lists'       => $mc->get( 'lists' ),
			'campaign'    => $mc_campaign_id ? $mc->get( "campaigns/$mc_campaign_id" ) : null,
			'campaign_id' => $mc_campaign_id,
		];
	}

	/**
	 * Get Mailchimp API key.
	 */
	public static function mailchimp_api_key() {
		return get_option( 'newspack_newsletters_mailchimp_api_key', false );
	}

	/**
	 * Check capabilities for using API.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return bool|WP_Error
	 */
	public static function api_permissions_check( $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new \WP_Error(
				'newspack_rest_forbidden',
				esc_html__( 'You cannot use this resource.', 'newspack' ),
				[
					'status' => 403,
				]
			);
		}
		return true;
	}

	/**
	 * Callback for CPT save. Will sync with Mailchimp.
	 *
	 * @param string  $id post ID.
	 * @param WP_Post $post the post.
	 * @param boolean $update whether it's an update.
	 */
	public static function sync_with_mailchimp( $id, $post, $update ) {
		$api_key = self::mailchimp_api_key();
		if ( ! $api_key ) {
			return;
		}

		$mc      = new Mailchimp( $api_key );
		$payload = [
			'type'         => 'regular',
			'content_type' => 'template',
			'settings'     => [
				'subject_line' => $post->post_title,
				'title'        => $post->post_title,
			],
		];

		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );

		if ( $update && $mc_campaign_id ) {
			$mc->patch( "campaigns/$mc_campaign_id", $payload );
		} else {
			$campaign       = $mc->post( 'campaigns', $payload );
			$mc_campaign_id = $campaign['id'];
			update_post_meta( $id, 'mc_campaign_id', $mc_campaign_id );
		}

		$renderer        = new Newspack_Newsletters_Renderer();
		$content_payload = [
			'html' => $renderer->render_html_email( $post ),
		];

		$result = $mc->put( "campaigns/$mc_campaign_id/content", $content_payload );
	}

	/**
	 * Get newsletter templates.
	 *
	 * @return array Array of templates.
	 */
	public static function get_newsletter_templates() {
		return apply_filters( 'newspack_newsletters_templates', [] );
	}

	/**
	 * Disable gradients in Newsletter CPT.
	 */
	public static function disable_gradients() {
		$screen = get_current_screen();
		if ( ! $screen || self::NEWSPACK_NEWSLETTERS_CPT !== $screen->post_type ) {
			return;
		}
		add_theme_support( 'editor-gradient-presets', array() );
		add_theme_support( 'disable-custom-gradients' );
	}

	/**
	 * Callback for CPT publish. Sends the campaign.
	 *
	 * @param string  $id post ID.
	 * @param WP_Post $post the post.
	 */
	public static function send_campaign( $id, $post ) {
		if ( self::NEWSPACK_NEWSLETTERS_CPT !== get_post_type( $id ) ) {
			return new WP_Error(
				'newspack_newsletters_incorrect_post_type',
				__( 'Post is not a Newsletter.', 'newspack-newsletters' )
			);
		}


		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		$mc = new Mailchimp( self::mailchimp_api_key() );

		$payload = [
			'send_type' => 'html',
		];
		$result  = $mc->post( "campaigns/$mc_campaign_id/actions/send", $payload );
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
		$logo           = $custom_logo_id ? wp_get_attachment_image_src( $custom_logo_id, 'thumbnail' )[0] : null;

		$sitename_block = sprintf(
			'<!-- wp:heading {"align":"center","level":1} --><h1 class="has-text-align-center">%s</h1><!-- /wp:heading -->',
			$sitename
		);

		$logo_block = $logo ? sprintf(
			'<!-- wp:image {"align":"center","id":%s,"sizeSlug":"thumbnail"} --><figure class="wp-block-image aligncenter size-thumbnail"><img src="%s" alt="%s" class="wp-image-%s" /></figure><!-- /wp:image -->',
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
	 * Set initial title of newsletter.
	 *
	 * @param string  $post_title Post title.
	 * @param WP_Post $post Post.
	 * @return string Title.
	 */
	public static function default_title( $post_title, $post ) {
		if ( self::NEWSPACK_NEWSLETTERS_CPT === get_post_type( $post ) ) {
			$post_title = gmdate( get_option( 'date_format' ) );
		}
		return $post_title;
	}
}
Newspack_Newsletters::instance();

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
		add_action( 'the_post', [ __CLASS__, 'remove_other_editor_modifications' ] );
		add_action( 'init', [ __CLASS__, 'register_cpt' ] );
		add_action( 'init', [ __CLASS__, 'register_meta' ] );
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'enqueue_block_editor_assets' ] );
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'disable_gradients' ] );
		add_action( 'rest_api_init', [ __CLASS__, 'rest_api_init' ] );
		add_action( 'default_title', [ __CLASS__, 'default_title' ], 10, 2 );
		add_action( 'save_post_' . self::NEWSPACK_NEWSLETTERS_CPT, [ __CLASS__, 'save_post' ], 10, 2 );
		add_action( 'publish_' . self::NEWSPACK_NEWSLETTERS_CPT, [ __CLASS__, 'send_campaign' ], 10, 2 );
		add_action( 'wp_trash_post', [ __CLASS__, 'trash_post' ], 10, 1 );
		add_filter( 'allowed_block_types', [ __CLASS__, 'newsletters_allowed_block_types' ], 10, 2 );

		$needs_nag =
			is_admin() &&
			( ! self::mailchimp_api_key() || ! get_option( 'newspack_newsletters_mjml_api_key', false ) || ! get_option( 'newspack_newsletters_mjml_api_secret', false ) ) &&
			! get_option( 'newspack_newsletters_activation_nag_viewed', false );

		if ( $needs_nag ) {
			add_action( 'admin_notices', [ __CLASS__, 'activation_nag' ] );
			add_action( 'admin_enqueue_scripts', [ __CLASS__, 'activation_nag_dismissal_script' ] );
			add_action( 'wp_ajax_newspack_newsletters_activation_nag_dismissal', [ __CLASS__, 'activation_nag_dismissal_ajax' ] );
		}
		include_once dirname( __FILE__ ) . '/class-newspack-newsletters-settings.php';
		include_once dirname( __FILE__ ) . '/class-newspack-newsletters-renderer.php';
	}

	/**
	 * Remove all editor enqueued assets besides this plugins'.
	 * This is to prevent theme styles being loaded in the editor.
	 * Remove editor color palette theme supports - the MJML parser uses a static list of default editor colors.
	 */
	public static function remove_other_editor_modifications() {
		if ( self::NEWSPACK_NEWSLETTERS_CPT != get_post_type() ) {
			return;
		}

		$enqueue_block_editor_assets_filters = $GLOBALS['wp_filter']['enqueue_block_editor_assets']->callbacks;
		foreach ( $enqueue_block_editor_assets_filters as $index => $filter ) {
			$action_handlers = array_keys( $filter );
			foreach ( $action_handlers as $handler ) {
				if ( __CLASS__ . '::enqueue_block_editor_assets' != $handler ) {
					remove_action( 'enqueue_block_editor_assets', $handler, $index );
				}
			}
		}

		remove_editor_styles();
		remove_theme_support( 'editor-color-palette' );
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
			'newspack-newsletters/posts-inserter',
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
						'sanitize_callback' => 'sanitize_text_field',
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
			'mailchimp/(?P<id>[\a-z]+)/interest/(?P<interest_id>[\a-z]+)',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_set_mailchimp_interest' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'          => [
						'sanitize_callback' => 'absint',
					],
					'interest_id' => [
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

		$mc_campaign_id = self::get_campaign_id( $id );

		$mc = self::api_mailchimp_instance();
		if ( is_wp_error( $mc ) ) {
			return $mc;
		}

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

		return self::handle_mailchimp_response( $mc->patch( "campaigns/$mc_campaign_id", $payload ), $id );
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


		$mc_campaign_id = self::get_campaign_id( $id );

		$mc = self::api_mailchimp_instance();
		if ( is_wp_error( $mc ) ) {
			return $mc;
		}
		$payload = [
			'recipients' => [
				'list_id' => $list_id,
			],
		];

		return self::handle_mailchimp_response( $mc->patch( "campaigns/$mc_campaign_id", $payload ), $id );
	}

	/**
	 * Set Mailchimp Interest.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_set_mailchimp_interest( $request ) {
		$id          = $request['id'];
		$exploded    = explode( ':', $request['interest_id'] );
		$field       = count( $exploded ) ? $exploded[0] : null;
		$interest_id = count( $exploded ) > 1 ? $exploded[1] : null;

		if ( self::NEWSPACK_NEWSLETTERS_CPT !== get_post_type( $id ) ) {
			return new WP_Error(
				'newspack_newsletters_incorrect_post_type',
				__( 'Post is not a Newsletter.', 'newspack-newsletters' )
			);
		}

		if ( 'no_interests' !== $request['interest_id'] && ( ! $field || ! $interest_id ) ) {
			return new WP_Error(
				'newspack_newsletters_incorrect_post_type',
				__( 'Invalid Mailchimp Interest .', 'newspack-newsletters' )
			);
		}

		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		$mc = self::api_mailchimp_instance();
		if ( is_wp_error( $mc ) ) {
			return $mc;
		}
		$campaign = self::handle_mailchimp_response( $mc->get( "campaigns/$mc_campaign_id" ) );
		if ( is_wp_error( $campaign ) ) {
			return $campaign;
		}
		$list_id = isset( $campaign, $campaign['recipients'], $campaign['recipients']['list_id'] ) ? $campaign['recipients']['list_id'] : null;

		if ( ! $list_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp list ID not found.', 'newspack-newsletters' )
			);
		}

		$segment_opts = ( 'no_interests' === $request['interest_id'] ) ?
			(object) [] :
			[
				'match'      => 'any',
				'conditions' => [
					[
						'condition_type' => 'Interests',
						'field'          => $field,
						'op'             => 'interestcontains',
						'value'          => [
							$interest_id,
						],
					],
				],
			];

		$payload = [
			'recipients' => [
				'list_id'      => $list_id,
				'segment_opts' => $segment_opts,
			],
		];

		$result = self::handle_mailchimp_response( $mc->patch( "campaigns/$mc_campaign_id", $payload ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
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
	 * Get Mailchimp handler instance.
	 */
	public static function api_mailchimp_instance() {
		$api_key = self::mailchimp_api_key();
		if ( ! $api_key ) {
			return new WP_Error(
				'newspack_newsletters_incorrect_post_type',
				__( 'No Mailchimp API key available.', 'newspack-newsletters' )
			);
		}
		try {
			return new Mailchimp( $api_key );
		} catch ( \Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$e->getMessage()
			);
		}
	}

	/**
	 * Get Mailchimp campaign ID from post meta.
	 *
	 * @param string $id post ID.
	 */
	public static function get_campaign_id( $id ) {
		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}
		return $mc_campaign_id;
	}

	/**
	 * Process Mailchimp API response. If the response has an error,
	 * will return WordPress error. Otherwise:
	 * - if post ID is provided, will return campaign data for that post.
	 * - if not, will return the input response.
	 *
	 * @param object $result Mailchimp API response.
	 * @param string $id post ID.
	 */
	public static function handle_mailchimp_response( $result, $id = false ) {
		if ( isset( $result['status'] ) && intval( $result['status'] ) >= 400 ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$result['title'],
				$result
			);
		}
		if ( $id ) {
			$data = self::retrieve_data( $id );
			return \rest_ensure_response( $data );
		}
		return $result;
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
		$mc_campaign_id = self::get_campaign_id( $id );

		$mc = self::api_mailchimp_instance();
		if ( is_wp_error( $mc ) ) {
			return $mc;
		}

		$test_emails = explode( ',', $test_email );
		foreach ( $test_emails as &$email ) {
			$email = sanitize_email( trim( $email ) );
		}
		$payload = [
			'test_emails' => $test_emails,
			'send_type'   => 'html',
		];

		return self::handle_mailchimp_response( $mc->post( "campaigns/$mc_campaign_id/actions/test", $payload ), $id );
	}

	/**
	 * Get Mailchimp data.
	 *
	 * @param string $id post ID.
	 */
	public static function retrieve_data( $id ) {
		$mc_campaign_id = self::get_campaign_id( $id );
		if ( is_wp_error( $mc_campaign_id ) ) {
			return $mc_campaign_id;
		}
		$mc = self::api_mailchimp_instance();
		if ( is_wp_error( $mc ) ) {
			return $mc;
		}
		$lists = self::handle_mailchimp_response( $mc->get( 'lists' ) );
		if ( is_wp_error( $lists ) ) {
			return $lists;
		}
		$campaign = self::handle_mailchimp_response( $mc->get( "campaigns/$mc_campaign_id" ) );
		if ( is_wp_error( $campaign ) ) {
			return $campaign;
		}

		$list_id             = $campaign && isset( $campaign['recipients']['list_id'] ) ? $campaign['recipients']['list_id'] : null;
		$interest_categories = null;
		if ( $list_id ) {
			$interest_categories = self::handle_mailchimp_response( $mc->get( "lists/$list_id/interest-categories" ) );
			if ( is_wp_error( $interest_categories ) ) {
				return $interest_categories;
			}
			if ( $interest_categories && count( $interest_categories['categories'] ) ) {
				foreach ( $interest_categories['categories'] as &$category ) {
					$category_id           = $category['id'];
					$category['interests'] = $mc->get( "lists/$list_id/interest-categories/$category_id/interests" );
				}
			}
		}

		return [
			'lists'               => $lists,
			'campaign'            => $campaign,
			'interest_categories' => $interest_categories,
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
	 */
	public static function save_post( $id, $post ) {
		$status = get_post_status( $id );
		if ( 'trash' === $status ) {
			return;
		}
		self::sync_with_mailchimp( $post );
	}

	/**
	 * Callback for CPT trashing. Will delete corresponding campaign on Mailchimp.
	 *
	 * @param string $id post ID.
	 */
	public static function trash_post( $id ) {
		if ( self::NEWSPACK_NEWSLETTERS_CPT !== get_post_type( $id ) ) {
			return;
		}
		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return;
		}

		$mc = self::api_mailchimp_instance();
		if ( is_wp_error( $mc ) ) {
			return $mc;
		}
		$campaign = self::handle_mailchimp_response( $mc->get( "campaigns/$mc_campaign_id" ) );
		if ( is_wp_error( $campaign ) ) {
			return $campaign;
		}
		if ( $campaign ) {
			$status = $campaign['status'];
			if ( ! in_array( $status, [ 'sent', 'sending' ] ) ) {
				$result = self::handle_mailchimp_response( $mc->delete( "campaigns/$mc_campaign_id" ) );
				if ( is_wp_error( $result ) ) {
					return $result;
				}
				delete_post_meta( $id, 'mc_campaign_id', $mc_campaign_id );
			}
		}
	}

	/**
	 * Synchronize CPT with Mailchimp campaign.
	 *
	 * @param WP_Post $post the post.
	 */
	public static function sync_with_mailchimp( $post ) {
		$mc = self::api_mailchimp_instance();
		if ( is_wp_error( $mc ) ) {
			return $mc;
		}
		$payload = [
			'type'         => 'regular',
			'content_type' => 'template',
			'settings'     => [
				'subject_line' => $post->post_title,
				'title'        => $post->post_title,
			],
		];

		$mc_campaign_id = get_post_meta( $post->ID, 'mc_campaign_id', true );
		if ( $mc_campaign_id ) {
			$campaign_result = self::handle_mailchimp_response( $mc->patch( "campaigns/$mc_campaign_id", $payload ) );
			if ( is_wp_error( $campaign_result ) ) {
				return $campaign_result;
			}
		} else {
			$campaign_result = self::handle_mailchimp_response( $mc->post( 'campaigns', $payload ) );
			if ( is_wp_error( $campaign_result ) ) {
				return $campaign_result;
			}
			$mc_campaign_id = $campaign_result['id'];
			update_post_meta( $post->ID, 'mc_campaign_id', $mc_campaign_id );
		}

		$renderer        = new Newspack_Newsletters_Renderer();
		$content_payload = [
			'html' => $renderer->render_html_email( $post ),
		];

		$content_result = self::handle_mailchimp_response( $mc->put( "campaigns/$mc_campaign_id/content", $content_payload ) );
		if ( is_wp_error( $content_result ) ) {
			return $content_result;
		}
		return [
			'campaign_result' => $campaign_result,
			'content_result'  => $content_result,
		];
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

		$sync_result = self::sync_with_mailchimp( $post );

		if ( is_wp_error( $sync_result ) ) {
			return $sync_result;
		}

		$mc_campaign_id = self::get_campaign_id( $id );

		$mc = self::api_mailchimp_instance();
		if ( is_wp_error( $mc ) ) {
			return $mc;
		}

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

	/**
	 * Activation Nag
	 */

	/**
	 * Add admin notice if API keys are unset.
	 */
	public static function activation_nag() {
		$screen = get_current_screen();
		if ( 'settings_page_newspack-newsletters-settings-admin' === $screen->base || 'newspack_nl_cpt' === $screen->post_type ) {
			return;
		}
		$url = admin_url( '/options-general.php?page=newspack-newsletters-settings-admin' );
		?>
		<div class="notice notice-info is-dismissible newspack-newsletters-notification-nag">
			<p>
				<?php
					echo wp_kses_post(
						sprintf(
							// translators: urge users to input their API keys on settings page.
							__( 'Thank you for activating Newspack Newsletters. Please <a href="%s">head to settings</a> to set up your API keys.', 'newspack-newsletters' ),
							$url
						)
					);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Enqueue script to handle activation nag dismissal.
	 */
	public static function activation_nag_dismissal_script() {
		$script = 'newspack-newsletters-activation_nag_dismissal';
		wp_register_script(
			$script,
			plugins_url( '../dist/admin.js', __FILE__ ),
			[ 'jquery' ],
			'1.0',
			false
		);
		wp_localize_script(
			$script,
			'newspack_newsletters_activation_nag_dismissal_params',
			[
				'ajaxurl' => get_admin_url() . 'admin-ajax.php',
			]
		);
		wp_enqueue_script( $script );
	}

	/**
	 * AJAX callback after nag has been dismissed.
	 */
	public static function activation_nag_dismissal_ajax() {
		update_option( 'newspack_newsletters_activation_nag_viewed', true );
	}
}
Newspack_Newsletters::instance();

<?php
/**
 * Newspack Newsletter Author
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

use \DrewM\MailChimp\MailChimp;

/**
 * Main Newspack Newsletters Class.
 */
final class Newspack_Newsletters {

	const NEWSPACK_NEWSLETTERS_CPT = 'newspack_nl_cpt';
	const EMAIL_HTML_META          = 'newspack_email_html';

	/**
	 * Supported fonts.
	 *
	 * @var array
	 */
	public static $supported_fonts = [
		'Arial, Helvetica, sans-serif',
		'Tahoma, sans-serif',
		'Trebuchet MS, sans-serif',
		'Verdana, sans-serif',
		'Georgia, serif',
		'Palatino, serif',
		'Times New Roman, serif',
		'Courier, monospace',
	];

	/**
	 * The single instance of the class.
	 *
	 * @var Newspack_Newsletters
	 */
	protected static $instance = null;

	/**
	 * Instance of the service provider class.
	 *
	 * @var Newspack_Newsletters_Service_Provider
	 */
	protected static $provider = null;

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
		add_action( 'init', [ __CLASS__, 'register_editor_only_meta' ] );
		add_action( 'init', [ __CLASS__, 'register_blocks' ] );
		add_action( 'rest_api_init', [ __CLASS__, 'rest_api_init' ] );
		add_action( 'default_title', [ __CLASS__, 'default_title' ], 10, 2 );
		add_action( 'wp_head', [ __CLASS__, 'public_newsletter_custom_style' ], 10, 2 );
		add_filter( 'display_post_states', [ __CLASS__, 'display_post_states' ], 10, 2 );
		add_filter( 'manage_' . self::NEWSPACK_NEWSLETTERS_CPT . '_posts_columns', [ __CLASS__, 'add_public_page_column' ] );
		add_action( 'manage_' . self::NEWSPACK_NEWSLETTERS_CPT . '_posts_custom_column', [ __CLASS__, 'public_page_column_content' ], 10, 2 );
		add_filter( 'post_row_actions', [ __CLASS__, 'display_view_or_preview_link_in_admin' ] );
		add_filter( 'jetpack_relatedposts_filter_options', [ __CLASS__, 'disable_jetpack_related_posts' ] );
		add_action( 'save_post_' . self::NEWSPACK_NEWSLETTERS_CPT, [ __CLASS__, 'save' ], 10, 3 );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'branding_scripts' ] );
		add_filter( 'newspack_theme_featured_image_post_types', [ __CLASS__, 'support_featured_image_options' ] );
		add_filter( 'gform_force_hooks_js_output', [ __CLASS__, 'suppress_gravityforms_js_on_newsletters' ] );
		add_filter( 'render_block', [ __CLASS__, 'remove_email_only_block' ], 10, 2 );
		add_action( 'pre_get_posts', [ __CLASS__, 'display_newsletters_in_archives' ] );
		add_action( 'the_post', [ __CLASS__, 'fix_public_status' ] );
		self::set_service_provider( self::service_provider() );

		$needs_nag = is_admin() && ! self::is_service_provider_configured() && ! get_option( 'newspack_newsletters_activation_nag_viewed', false );
		if ( $needs_nag ) {
			add_action( 'admin_notices', [ __CLASS__, 'activation_nag' ] );
			add_action( 'admin_enqueue_scripts', [ __CLASS__, 'activation_nag_dismissal_script' ] );
			add_action( 'wp_ajax_newspack_newsletters_activation_nag_dismissal', [ __CLASS__, 'activation_nag_dismissal_ajax' ] );
		}
	}

	/**
	 * Set service provider.
	 *
	 * @param string $service_provider Service provider slug.
	 */
	public static function set_service_provider( $service_provider ) {
		update_option( 'newspack_newsletters_service_provider', $service_provider );
		switch ( $service_provider ) {
			case 'mailchimp':
				self::$provider = Newspack_Newsletters_Mailchimp::instance();
				break;
			case 'constant_contact':
				self::$provider = Newspack_Newsletters_Constant_Contact::instance();
				break;
			case 'campaign_monitor':
				self::$provider = Newspack_Newsletters_Campaign_Monitor::instance();
				break;
			case 'active_campaign':
				self::$provider = Newspack_Newsletters_Active_Campaign::instance();
				break;
		}
	}

	/**
	 * Get the current service provider instance.
	 */
	public static function get_service_provider() {
		return self::$provider;
	}

	/**
	 * Register custom fields for use in the editor only.
	 * These have to be registered so the updates are handles correctly.
	 */
	public static function register_editor_only_meta() {
		$fields = [
			[
				'name'               => 'newsletterData',
				'register_meta_args' => [
					'show_in_rest' => [
						'schema' => [
							'type'                 => 'object',
							'context'              => [ 'edit' ],
							'additionalProperties' => true,
							'properties'           => [],
						],
					],
					'type'         => 'object',
				],
			],
			[
				'name'               => 'newsletterValidationErrors',
				'register_meta_args' => [
					'show_in_rest' => [
						'schema' => [
							'type'    => 'array',
							'context' => [ 'edit' ],
							'items'   => [
								'type' => 'string',
							],
						],
					],
					'type'         => 'array',
				],
			],
			[
				'name'               => 'senderName',
				'register_meta_args' => [
					'show_in_rest' => [
						'schema' => [
							'context' => [ 'edit' ],
						],
					],
					'type'         => 'string',
				],
			],
			[
				'name'               => 'senderEmail',
				'register_meta_args' => [
					'show_in_rest' => [
						'schema' => [
							'context' => [ 'edit' ],
						],
					],
					'type'         => 'string',
				],
			],
		];
		foreach ( $fields as $field ) {
			\register_meta(
				'post',
				$field['name'],
				array_merge(
					$field['register_meta_args'],
					[
						'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
						'single'         => true,
						'auth_callback'  => '__return_true',
					]
				)
			);
		}
	}

	/**
	 * Register custom fields.
	 */
	public static function register_meta() {
		\register_meta(
			'post',
			'template_id',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'integer',
				'single'         => true,
				'auth_callback'  => '__return_true',
				'default'        => -1,
			]
		);
		\register_meta(
			'post',
			'newsletter_sent',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'integer',
				'single'         => true,
				'auth_callback'  => '__return_true',
				'default'        => 0,
			]
		);
		\register_meta(
			'post',
			'font_header',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'font_body',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'background_color',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'preview_text',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'diable_ads',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'boolean',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'is_public',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'boolean',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
		\register_meta(
			'post',
			'custom_css',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => [
					'schema' => [
						'context' => [ 'edit' ],
					],
				],
				'type'           => 'string',
				'single'         => true,
				'default'        => '',
				'auth_callback'  => '__return_true',
			]
		);
	}

	/**
	 * Set default layout.
	 * This can be removed once WP 5.5 adoption is sufficient.
	 *
	 * @param string  $post_id Numeric ID of the campaign.
	 * @param WP_Post $post The complete post object.
	 * @param boolean $update Whether this is an existing post being updated or not.
	 */
	public static function save( $post_id, $post, $update ) {
		if ( ! $update ) {
			update_post_meta( $post_id, 'template_id', -1 );
		}
	}

	/**
	 * Register the custom post type.
	 */
	public static function register_cpt() {
		$public_slug = get_option( 'newspack_newsletters_public_posts_slug', 'newsletter' );

		// Prevent empty slug value.
		if ( empty( $public_slug ) ) {
			$public_slug = 'newsletter';
		}

		$labels = [
			'name'                     => _x( 'Newsletters', 'post type general name', 'newspack-newsletters' ),
			'singular_name'            => _x( 'Newsletter', 'post type singular name', 'newspack-newsletters' ),
			'menu_name'                => _x( 'Newsletters', 'admin menu', 'newspack-newsletters' ),
			'name_admin_bar'           => _x( 'Newsletter', 'add new on admin bar', 'newspack-newsletters' ),
			'add_new'                  => _x( 'Add New', 'newsletter', 'newspack-newsletters' ),
			'add_new_item'             => __( 'Add New Newsletter', 'newspack-newsletters' ),
			'new_item'                 => __( 'New Newsletter', 'newspack-newsletters' ),
			'edit_item'                => __( 'Edit Newsletter', 'newspack-newsletters' ),
			'view_item'                => __( 'View Newsletter', 'newspack-newsletters' ),
			'view_items'               => __( 'View Newsletters', 'newspack-newsletters' ),
			'all_items'                => __( 'All Newsletters', 'newspack-newsletters' ),
			'search_items'             => __( 'Search Newsletters', 'newspack-newsletters' ),
			'parent_item_colon'        => __( 'Parent Newsletters:', 'newspack-newsletters' ),
			'not_found'                => __( 'No newsletters found.', 'newspack-newsletters' ),
			'not_found_in_trash'       => __( 'No newsletters found in Trash.', 'newspack-newsletters' ),
			'archives'                 => __( 'Newsletter Archives', 'newspack-newsletters' ),
			'attributes'               => __( 'Newsletter Attributes', 'newspack-newsletters' ),
			'insert_into_item'         => __( 'Insert into newsletter', 'newspack-newsletters' ),
			'uploaded_to_this_item'    => __( 'Uploaded to this newsletter', 'newspack-newsletters' ),
			'filter_items_list'        => __( 'Filter newsletters list', 'newspack-newsletters' ),
			'items_list_navigation'    => __( 'Newsletters list navigation', 'newspack-newsletters' ),
			'items_list'               => __( 'Newsletters list', 'newspack-newsletters' ),
			'item_published'           => __( 'Newsletter sent.', 'newspack-newsletters' ),
			'item_published_privately' => __( 'Newsletter published privately.', 'newspack-newsletters' ),
			'item_reverted_to_draft'   => __( 'Newsletter reverted to draft.', 'newspack-newsletters' ),
			'item_scheduled'           => __( 'Newsletter scheduled.', 'newspack-newsletters' ),
			'item_updated'             => __( 'Newsletter updated.', 'newspack-newsletters' ),
			'item_link'                => __( 'Newsletter Link', 'newspack-newsletters' ),
			'item_link_description'    => __( 'A link to a newsletter.', 'newspack-newsletters' ),
		];

		$cpt_args = [
			'has_archive'      => $public_slug,
			'labels'           => $labels,
			'public'           => true,
			'public_queryable' => true,
			'query_var'        => true,
			'rewrite'          => [ 'slug' => $public_slug ],
			'show_ui'          => true,
			'show_in_rest'     => true,
			'supports'         => [ 'author', 'editor', 'title', 'custom-fields', 'newspack_blocks', 'revisions', 'thumbnail', 'excerpt' ],
			'taxonomies'       => [ 'category', 'post_tag' ],
			'menu_icon'        => 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0Ij48cGF0aCB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGQ9Ik0yMS45OSA4YzAtLjcyLS4zNy0xLjM1LS45NC0xLjdMMTIgMSAyLjk1IDYuM0MyLjM4IDYuNjUgMiA3LjI4IDIgOHYxMGMwIDEuMS45IDIgMiAyaDE2YzEuMSAwIDItLjkgMi0ybC0uMDEtMTB6TTEyIDEzTDMuNzQgNy44NCAxMiAzbDguMjYgNC44NEwxMiAxM3oiIGZpbGw9IiNhMGE1YWEiLz48L3N2Zz4K',
		];
		\register_post_type( self::NEWSPACK_NEWSLETTERS_CPT, $cpt_args );
	}

	/**
	 * Register blocks server-side for front-end rendering.
	 */
	public static function register_blocks() {
		$block_definition = json_decode(
			file_get_contents( __DIR__ . '/../src/editor/blocks/posts-inserter/block.json' ), // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			true
		);
		register_block_type(
			$block_definition['name'],
			[
				'render_callback' => [ __CLASS__, 'render_posts_inserter_block' ],
				'attributes'      => $block_definition['attributes'],
				'supports'        => $block_definition['supports'],
			]
		);
		register_block_type(
			'newspack-newsletters/share',
			[
				'render_callback' => [ __CLASS__, 'render_share_block' ],
			]
		);
	}

	/**
	 * Server-side render callback for Posts Inserter block.
	 *
	 * @param array $attributes Block attributes.
	 * @return string HTML of block content to render.
	 */
	public static function render_posts_inserter_block( $attributes ) {
		$markup = '';

		if ( empty( $attributes['innerBlocksToInsert'] ) || ! is_array( $attributes['innerBlocksToInsert'] ) ) {
			return $markup;
		}

		foreach ( $attributes['innerBlocksToInsert'] as $inner_block ) {
			$markup .= $inner_block['innerHTML'];
		}

		return wp_kses_post( $markup );
	}

	/**
	 * Server-side render callback for Share block.
	 * It does not make sense to render anything when the email
	 * is viewed as a public post.
	 */
	public static function render_share_block() {
		return '';
	}

	/**
	 * Filter post states in admin posts list.
	 *
	 * @param array   $post_states An array of post display states.
	 * @param WP_Post $post        The current post object.
	 * @return array The filtered $post_states array.
	 */
	public static function display_post_states( $post_states, $post ) {
		if ( self::NEWSPACK_NEWSLETTERS_CPT !== $post->post_type ) {
			return $post_states;
		}

		$post_status = get_post_status_object( $post->post_status );
		$sent        = self::is_newsletter_sent( $post->ID );
		$is_public   = get_post_meta( $post->ID, 'is_public', true );

		if ( $sent ) {
			$time_diff = time() - $sent;

			// Show relative date if sent within the past 24 hours.
			if ( $time_diff < 86400 ) {
				$sent_from_now = human_time_diff( $sent, time() );
				/* translators: Relative time stamp of sent/published date */
				$post_states[ $post_status->name ] = sprintf( __( 'Sent %1$s ago', 'newspack-newsletters' ), $sent_from_now );
			} else {
				/* translators:  Absolute time stamp of sent/published date */
				$post_states[ $post_status->name ] = sprintf( __( 'Sent %1$s', 'newspack-newsletters' ), ( new DateTime( '@' . $sent ) )->format( get_option( 'date_format' ) ) );
			}
		}

		return $post_states;
	}

	/**
	 * Add "Public page" admin column
	 *
	 * @param array $columns Newsletters columns.
	 *
	 * @return array
	 */
	public static function add_public_page_column( $columns ) {
		return array_merge( $columns, [ 'public_page' => __( 'Public page', 'newspack-newsletters' ) ] );
	}

	/**
	 * Add "Public page" admin column content
	 * Displays wether the newsletter post has a public page or not
	 *
	 * @param string $column_name Column name.
	 * @param int    $post_id     Post ID.
	 */
	public static function public_page_column_content( $column_name, $post_id ) {
		if ( 'public_page' === $column_name ) {
			$is_public = get_post_meta( $post_id, 'is_public', true );
			?>
			<span class="inline_data is_public" data-is_public="<?php echo esc_attr( $is_public ); ?>">
				<?php echo empty( $is_public ) ? esc_html__( 'No', 'newspack-newsletters' ) : esc_html__( 'Yes', 'newspack-newsletters' ); ?>
			</span>
			<?php
		}
	}

	/**
	 * Make "View" links say "Preview" if the newsletter is not marked as public.
	 *
	 * @param array $actions Array of action links to be shown in admin posts list.
	 * @return array Filtered array of action links.
	 */
	public static function display_view_or_preview_link_in_admin( $actions ) {
		if ( 'publish' !== get_post_status() || self::NEWSPACK_NEWSLETTERS_CPT !== get_post_type() ) {
			return $actions;
		}

		$is_public = get_post_meta( get_the_ID(), 'is_public', true );

		if ( empty( $is_public ) && isset( $actions['view'] ) ) {
			$actions['view'] = '<a href="' . esc_url( get_the_permalink() ) . '" rel="bookmark" aria-label="View ' . esc_attr( get_the_title() ) . '">Preview</a>';
		}

		return $actions;
	}

	/**
	 * Disable Jetpack Related Posts on Newsletter posts.
	 *
	 * @param array $options Options array for Jetpack Related Posts.
	 * @return array Filtered options array.
	 */
	public static function disable_jetpack_related_posts( $options ) {
		if (
			self::NEWSPACK_NEWSLETTERS_CPT === get_post_type() &&
			! empty( get_option( 'newspack_newsletters_disable_related_posts' ) )
		) {
			$options['enabled'] = false;
		}

		return $options;
	}

	/**
	 * Add newspack_popups_is_sitewide_default to Popup object.
	 */
	public static function rest_api_init() {
		\register_rest_route(
			'newspack-newsletters/v1',
			'layouts',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'api_get_layouts' ],
				'permission_callback' => [ __CLASS__, 'api_authoring_permissions_check' ],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1',
			'settings',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'api_get_settings' ],
				'permission_callback' => [ __CLASS__, 'api_administration_permissions_check' ],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1',
			'settings',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_set_settings' ],
				'permission_callback' => [ __CLASS__, 'api_administration_permissions_check' ],
				'args'                => [
					'mailchimp_api_key' => [
						'sanitize_callback' => 'sanitize_text_field',
					],
				],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1',
			'color-palette',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_set_color_palette' ],
				'permission_callback' => [ __CLASS__, 'api_authoring_permissions_check' ],
			]
		);

		\register_rest_route(
			'wp/v2/' . Newspack_Newsletters_Ads::NEWSPACK_NEWSLETTERS_ADS_CPT,
			'count',
			[
				/**
				 * Return an array of properties required to render a useful ads warning.
				 *
				 * @uses Newspack_Newsletters::get_ads_warning_in_editor()
				 */
				'callback'            => [ __CLASS__, 'get_ads_warning_in_editor' ],
				'methods'             => 'GET',

				/**
				 * Ensure the user can call this route.
				 *
				 * @uses Newspack_Newsletters::api_administration_permissions_check()
				 */
				'permission_callback' => [ __CLASS__, 'api_administration_permissions_check' ],
			]
		);

		\register_rest_route(
			'newspack-newsletters/v1',
			'post-mjml',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_get_mjml' ],
				'permission_callback' => [ __CLASS__, 'api_authoring_permissions_check' ],
				'args'                => [
					'post_id' => [
						'required'          => true,
						'sanitize_callback' => 'absint',
					],
					'content' => [
						'required' => true,
					],
				],
			]
		);
	}

	/**
	 * The default color palette lives in the editor frontend and is not
	 * retrievable on the backend. The workaround is to set it as an option
	 * so that it's available to the email renderer.
	 *
	 * The editor can send multiple color palettes, so we're merging them.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_set_color_palette( $request ) {
		update_option(
			'newspack_newsletters_color_palette',
			wp_json_encode(
				array_merge(
					json_decode( (string) get_option( 'newspack_newsletters_color_palette', '{}' ), true ) ?? [],
					json_decode( $request->get_body(), true )
				)
			)
		);
		return \rest_ensure_response( [] );
	}

	/**
	 * Get MJML markup for a post.
	 * Content is sent straight from the editor, because all this happens
	 * before post is saved in the database.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_get_mjml( $request ) {
		$post = get_post( $request['post_id'] );
		if ( ! empty( $request['title'] ) ) {
			$post->post_title = $request['title'];
		}
		$post->post_content = $request['content'];
		return \rest_ensure_response( [ 'mjml' => Newspack_Newsletters_Renderer::render_post_to_mjml( $post ) ] );
	}

	/**
	 * Set post meta.
	 * The save_post action fires before post meta is updated.
	 * This causes newsletters to be synced to the ESP before recent changes to custom fields have been recorded,
	 * which leads to incorrect rendering. This is addressed through custom endpoints to update the  fields
	 * as soon as they are changed in the editor, so that the changes are available the next time sync to ESP occurs.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_set_post_meta( $request ) {
		$id    = $request['id'];
		$key   = $request['key'];
		$value = $request['value'];
		update_post_meta( $id, $key, $value );
		return [];
	}

	/**
	 * Validate ID is a Newsletter post type.
	 *
	 * @param int $id Post ID.
	 */
	public static function validate_newsletter_id( $id ) {
		return self::NEWSPACK_NEWSLETTERS_CPT === get_post_type( $id );
	}

	/**
	 * Retrieve Layouts.
	 */
	public static function api_get_layouts() {
		$layouts_query = new WP_Query(
			[
				'post_type'      => Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'posts_per_page' => -1,
			]
		);
		$user_layouts  = array_map(
			function ( $post ) {
				$post->meta = [
					'background_color' => get_post_meta( $post->ID, 'background_color', true ),
					'font_body'        => get_post_meta( $post->ID, 'font_body', true ),
					'font_header'      => get_post_meta( $post->ID, 'font_header', true ),
					'custom_css'       => get_post_meta( $post->ID, 'custom_css', true ),
				];
				return $post;
			},
			$layouts_query->get_posts()
		);
		$layouts       = array_merge(
			$user_layouts,
			Newspack_Newsletters_Layouts::get_default_layouts(),
			apply_filters( 'newspack_newsletters_templates', [] )
		);

		return \rest_ensure_response( $layouts );
	}

	/**
	 * Retrieve service API settings for API endpoints.
	 */
	public static function api_get_settings() {
		return \rest_ensure_response( self::api_settings() );
	}

	/**
	 * Set API settings.
	 *
	 * @param WP_REST_Request $request API request object.
	 */
	public static function api_set_settings( $request ) {
		$service_provider = $request['service_provider'];
		$credentials      = $request['credentials'];
		$wp_error         = new WP_Error();

		// Service Provider slug.
		if ( empty( $service_provider ) ) {
			$wp_error->add(
				'newspack_newsletters_no_service_provider',
				__( 'Please select a newsletter service provider.', 'newspack-newsletters' )
			);
		} else {
			self::set_service_provider( $service_provider );
		}

		// Service Provider credentials.
		if ( 'manual' !== $service_provider ) {
			if ( empty( $credentials ) ) {
				$wp_error->add(
					'newspack_newsletters_invalid_keys',
					__( 'Please input credentials.', 'newspack-newsletters' )
				);
			} else {
				$status = self::$provider->set_api_credentials( $credentials );
				if ( is_wp_error( $status ) ) {
					foreach ( $status->errors as $code => $message ) {
						$wp_error->add( $code, implode( ' ', $message ) );
					}
				}
			}
		}

		return $wp_error->has_errors() ? $wp_error : self::api_get_settings();
	}

	/**
	 * Retrieve settings.
	 */
	public static function api_settings() {
		$service_provider = self::service_provider();
		$response         = [
			'service_provider' => $service_provider ? $service_provider : '',
			'status'           => false,
		];
		$is_esp_manual    = 'manual' === $service_provider;

		// 'newspack_mailchimp_api_key' is a new option introduced to manage MC API key accross Newspack plugins.
		// Keeping the old option for backwards compatibility.
		if ( ! $is_esp_manual && ! self::$provider && get_option( 'newspack_mailchimp_api_key', get_option( 'newspack_newsletters_mailchimp_api_key' ) ) ) {
			// Legacy – Mailchimp provider set before multi-provider handling was set up.
			self::set_service_provider( 'mailchimp' );
		}

		if ( self::$provider ) {
			$response['credentials'] = self::$provider->api_credentials();
		}

		if (
			$is_esp_manual ||
			( self::$provider && self::$provider->has_api_credentials() )
		) {
			$response['status'] = true;
		}

		return $response;
	}

	/**
	 * Are all the needed API credentials available?
	 *
	 * @return bool Whether all API credentials are set.
	 */
	public static function is_service_provider_configured() {
		$settings = self::api_settings();
		return $settings['status'];
	}

	/**
	 * Check capabilities for using the API for administration tasks.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return bool|WP_Error
	 */
	public static function api_administration_permissions_check( $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new \WP_Error(
				'newspack_rest_forbidden',
				esc_html__( 'You cannot use this resource.', 'newspack-newsletters' ),
				[
					'status' => 403,
				]
			);
		}
		return true;
	}

	/**
	 * Check capabilities for using the API for authoring tasks.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return bool|WP_Error
	 */
	public static function api_authoring_permissions_check( $request ) {
		if ( ! current_user_can( 'edit_others_posts' ) ) {
			return new \WP_Error(
				'newspack_rest_forbidden',
				esc_html__( 'You cannot use this resource.', 'newspack-newsletters' ),
				[
					'status' => 403,
				]
			);
		}
		return true;
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
	 * Handle custom Newsletter styling when viewing the newsletter as a public post.
	 */
	public static function public_newsletter_custom_style() {
		if ( ! is_single() ) {
			return;
		}
		$post = get_post();
		if ( $post && self::NEWSPACK_NEWSLETTERS_CPT === $post->post_type ) {
			$font_header      = get_post_meta( $post->ID, 'font_header', true );
			$font_body        = get_post_meta( $post->ID, 'font_body', true );
			$background_color = get_post_meta( $post->ID, 'background_color', true );
			?>
				<style>
					.main-content {
						background-color: <?php echo esc_attr( $background_color ); ?>;
						font-family: <?php echo esc_attr( $font_body ); ?>;
					}
					.main-content h1,
					.main-content h2,
					.main-content h3,
					.main-content h4,
					.main-content h5,
					.main-content h6 {
						font-family: <?php echo esc_attr( $font_header ); ?>;
					}
					<?php if ( $background_color ) : ?>
						.entry-content {
							padding: 0 32px;;
						}
					<?php endif; ?>
				</style>
			<?php
		}
	}

	/**
	 * Activation Nag
	 */

	/**
	 * Add admin notice if API credentials are unset.
	 */
	public static function activation_nag() {
		$screen = get_current_screen();
		if ( 'settings_page_newspack-newsletters-settings-admin' === $screen->base || self::NEWSPACK_NEWSLETTERS_CPT === $screen->post_type ) {
			return;
		}
		$url = admin_url( 'edit.php?post_type=' . self::NEWSPACK_NEWSLETTERS_CPT . '&page=newspack-newsletters-settings-admin' );
		?>
		<div class="notice notice-info is-dismissible newspack-newsletters-notification-nag">
			<p>
				<?php
					echo wp_kses_post(
						sprintf(
							// translators: urge users to input their API credentials on settings page.
							__( 'Thank you for activating Newspack Newsletters. Please <a href="%s">head to settings</a> to set up your API credentials.', 'newspack-newsletters' ),
							$url
						)
					);
				?>
			</p>
		</div>
		<?php
	}

	/**
	 * Enqueue style to handle Newspack branding.
	 */
	public static function branding_scripts() {
		$screen = get_current_screen();
		if (
			self::NEWSPACK_NEWSLETTERS_CPT !== $screen->post_type &&
			Newspack_Newsletters_Ads::NEWSPACK_NEWSLETTERS_ADS_CPT !== $screen->post_type
		) {
			return;
		}

		$script = 'newspack-newsletters-branding_scripts';
		wp_enqueue_script(
			$script,
			plugins_url( '../dist/branding.js', __FILE__ ),
			[ 'jquery' ],
			'1.0',
			false
		);
		wp_enqueue_style(
			$script,
			plugins_url( '../dist/branding.css', __FILE__ ),
			[],
			'1.0',
			'screen'
		);
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

	/**
	 * Is wp-config debug flag set.
	 *
	 * @return boolean Is debug mode on?
	 */
	public static function debug_mode() {
		return defined( 'NEWSPACK_NEWSLETTERS_DEBUG_MODE' ) ? NEWSPACK_NEWSLETTERS_DEBUG_MODE : false;
	}


	/**
	 * Get properties required to render a useful modal in the editor that alerts
	 * users of ads they're sending.
	 *
	 * @param WP_REST_REQUEST $request The WP Request Object.
	 * @return array
	 */
	public static function get_ads_warning_in_editor( $request ) {
		$letterhead                 = new Newspack_Newsletters_Letterhead();
		$has_letterhead_credentials = $letterhead->has_api_credentials();
		$post_date                  = $request->get_param( 'date' );
		$newspack_ad_type           = Newspack_Newsletters_Ads::NEWSPACK_NEWSLETTERS_ADS_CPT;

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
		];
	}


	/**
	 * Which Email Service Provider should be used.
	 *
	 * @return string Name of the Email Service Provider.
	 */
	public static function service_provider() {
		return get_option( 'newspack_newsletters_service_provider', false );
	}

	/**
	 * If using a Newspack theme, add support for featured image options.
	 *
	 * @param array $post_types Array of supported post types.
	 * @return array Filtered array of supported post types.
	 */
	public static function support_featured_image_options( $post_types ) {
		return array_merge(
			$post_types,
			[ self::NEWSPACK_NEWSLETTERS_CPT ]
		);
	}

	/**
	 * Prevent Gravityforms from injecting scripts into the newsletter markup.
	 *
	 * @param bool $force_js Whether to force GF to inject scripts (default: true).
	 * @return bool Modified $force_js.
	 */
	public static function suppress_gravityforms_js_on_newsletters( $force_js ) {
		if ( self::NEWSPACK_NEWSLETTERS_CPT === get_post_type() ) {
			return false;
		}

		return $force_js;
	}

	/**
	 * Do not display blocks that are configured to be email-only.
	 *
	 * @param string $block_content The block content about to be appended.
	 * @param array  $block         The full block, including name and attributes.
	 *
	 * @return string Transformed block content to be apppended.
	 */
	public static function remove_email_only_block( $block_content, $block ) {
		if (
			self::NEWSPACK_NEWSLETTERS_CPT === get_post_type() &&
			isset( $block['attrs']['newsletterVisibility'] ) &&
			'email' === $block['attrs']['newsletterVisibility']
		) {
			return '';
		}
		return $block_content;
	}

	/**
	 * Get mailing lists of the configured ESP.
	 */
	public static function get_esp_lists() {
		if ( self::is_service_provider_configured() ) {
			if ( 'manual' === self::service_provider() ) {
				return new WP_Error(
					'newspack_newsletters_manual_lists',
					__( 'Lists not available while using manual configuration.', 'newspack-newsletters' )
				);
			}
			if ( ! self::$provider ) {
				return new WP_Error(
					'newspack_newsletters_esp_not_a_provider',
					__( 'Lists not available for the current Newsletters setup.', 'newspack-newsletters' )
				);
			}
			try {
				return self::$provider->get_lists();
			} catch ( \Exception $e ) {
				return new WP_Error(
					'newspack_newsletters_get_lists',
					$e->getMessage()
				);
			}
		}
		return [];
	}

	/**
	 * Add contact to a mailing list of the configured ESP.
	 *
	 * This method is soon to be deprecated.
	 * Use Newspack_Newsletters_Subscription::add_contact() instead.
	 *
	 * @param array  $contact The contact to add to the list.
	 * @param string $list_id ID of the list to add the contact to.
	 */
	public static function add_contact( $contact, $list_id ) {
		if ( self::is_service_provider_configured() ) {
			try {
				return self::$provider->add_contact( $contact, $list_id );
			} catch ( \Exception $e ) {
				return new WP_Error(
					'newspack_newsletters_get_lists',
					$e->getMessage()
				);
			}
		}
	}

	/**
	 * Mark newsletter as sent.
	 *
	 * @param int $post_id Post ID.
	 * @param int $time    Optional timestamp to mark as sent. Default is now.
	 */
	public static function set_newsletter_sent( $post_id, $time = 0 ) {
		update_post_meta( $post_id, 'newsletter_sent', 0 < $time ? $time : time() );
	}

	/**
	 * Whether the newsletter has been marked as sent.
	 *
	 * @param int $post_id Post ID.
	 *
	 * @return false|int False if not sent, or timestamp of when it was sent.
	 */
	public static function is_newsletter_sent( $post_id ) {
		/** Handle scheduled newsletter state. */
		$sending_scheduled = get_post_meta( $post_id, 'sending_scheduled', true );
		if ( $sending_scheduled ) {
			return false;
		}

		/** Handle scheduled newsletter error. */
		$scheduling_error = get_transient( sprintf( 'newspack_newsletters_scheduling_error_%s', $post_id ) );
		if ( $scheduling_error ) {
			return false;
		}

		/** Detect meta that determines the sent state */
		$sent = get_post_meta( $post_id, 'newsletter_sent', true );
		if ( 0 < $sent ) {
			return $sent;
		}

		/** Legacy check for sent/publish newsletters without meta. */
		if ( 'publish' === get_post_status( $post_id ) ) {
			$post = get_post( $post_id );
			$sent = strtotime( $post->post_date );
			self::set_newsletter_sent( $post_id, $sent );
			return $sent;
		}

		return false;
	}

	/**
	 * Display newsletters in archive pages.
	 *
	 * @param WP_Query $query The query.
	 */
	public static function display_newsletters_in_archives( $query ) {
		if ( is_admin() || ! $query->is_main_query() ) {
			return;
		}
		if ( $query->is_archive() && ! $query->is_post_type_archive() ) {
			$post_type = $query->get( 'post_type' );
			if ( empty( $post_type ) ) {
				$post_type = [ 'post' ];
			}
			if ( ! is_array( $post_type ) ) {
				$post_type = [ $post_type ];
			}
			$post_type[] = self::NEWSPACK_NEWSLETTERS_CPT;
			$query->set( 'post_type', $post_type );
		}
	}

	/**
	 * Fix the post status of a newsletter. Ensures a newsletter is 'private' if
	 * the 'is_public' is not found or false.
	 *
	 * @param WP_Post $post The post object.
	 */
	public static function fix_public_status( $post ) {
		// Only run if it's a newsletter post.
		if ( ! self::validate_newsletter_id( $post->ID ) ) {
			return;
		}
		$is_public = (bool) get_post_meta( $post->ID, 'is_public', true );
		if ( 'publish' === $post->post_status && ! $is_public ) {
			wp_update_post(
				[
					'ID'          => $post->ID,
					'post_status' => 'private',
				],
				false,
				false
			);
			// Force a page refresh on the front-end.
			if ( ! is_admin() ) {
				header( 'Refresh:0' );
				exit;
			}
		}
	}
}
Newspack_Newsletters::instance();

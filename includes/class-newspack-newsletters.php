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
		add_action( 'rest_api_init', [ __CLASS__, 'rest_api_init' ] );
		add_action( 'publish_' . self::NEWSPACK_NEWSLETTERS_CPT, [ __CLASS__, 'newsletter_published' ], 10, 2 );
		include_once dirname( __FILE__ ) . '/class-newspack-newsletters-settings.php';

		// include_once dirname( __FILE__ ) . '/class-newspack-popups-model.php';
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
			'menu_icon'    => 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjYTBhNWFhIiBkPSJNMTEuOTkgMTguNTRsLTcuMzctNS43M0wzIDE0LjA3bDkgNyA5LTctMS42My0xLjI3LTcuMzggNS43NHpNMTIgMTZsNy4zNi01LjczTDIxIDlsLTktNy05IDcgMS42MyAxLjI3TDEyIDE2eiIvPjwvc3ZnPgo=',
		];
		\register_post_type( self::NEWSPACK_NEWSLETTERS_CPT, $cpt_args );
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
	}

	/**
	 * Add newspack_popups_is_sitewide_default to Popup object.
	 */
	public static function rest_api_init() {
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)',
			[
				'methods'  => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'api_mailchimp_data' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'      => [
						'sanitize_callback' => 'absint',
					],
				],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)/test',
			[
				'methods'  => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_test_mailchimp_campaign' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'      => [
						'sanitize_callback' => 'absint',
					],
				],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)/send',
			[
				'methods'  => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_send_mailchimp_campaign' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'      => [
						'sanitize_callback' => 'absint',
					],
				],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)/list/(?P<list_id>[\a-z]+)',
			[
				'methods'  => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_set_mailchimp_list' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'      => [
						'sanitize_callback' => 'absint',
					],
					'list_id'      => [
						'sanitize_callback' => 'esc_attr',
					],
				],
			]
		);
		\register_rest_route(
			'newspack-newsletters/v1/',
			'mailchimp/(?P<id>[\a-z]+)/template/(?P<template_id>[\a-z]+)',
			[
				'methods'  => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_set_mailchimp_template' ],
				'permission_callback' => [ __CLASS__, 'api_permissions_check' ],
				'args'                => [
					'id'      => [
						'sanitize_callback' => 'absint',
					],
					'template_id'      => [
						'sanitize_callback' => 'esc_attr',
					],
				],
			]
		);
	}

	public static function api_set_mailchimp_list( $request ) {
		$id = $request['id'];
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

		$mc = new Mailchimp( self::mailchimp_api_key() );
		$payload = [
			'recipients' => [
				'list_id' => $list_id,
			],
		];
		$result = $mc->patch( "campaigns/$mc_campaign_id", $payload );

		$data = self::retrieve_data( $id );
		$data['result'] = $result;

		return \rest_ensure_response( $data );
	}

	public static function api_set_mailchimp_template( $request ) {
		$id = $request['id'];
		$template_id = intval( $request['template_id'] );

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
				'template_id' => $template_id,
			],
		];
		error_log( $template_id );
		$result = $mc->patch( "campaigns/$mc_campaign_id", $payload );

		$data = self::retrieve_data( $id );
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

		\register_meta(
			'post',
			'mc_template_id',
			[
				'object_subtype' => self::NEWSPACK_NEWSLETTERS_CPT,
				'show_in_rest'   => true,
				'type'           => 'string',
				'single'         => true,
				'auth_callback'  => '__return_true',
			]
		);
	}

	public static function api_mailchimp_data( $request ) {
		return \rest_ensure_response( self::retrieve_data( $request[ 'id' ] ) );
	}

	public static function api_test_mailchimp_campaign( $request ) {
		$id = $request['id'];
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
			'test_emails' => [
				'j.max.rabb@gmail.com',
				'jefferson.rabb@automattic.com',
			],
			'send_type' => 'html',
		];
		$result = $mc->post( "campaigns/$mc_campaign_id/actions/test", $payload );

		$data = self::retrieve_data( $id );
		$data['result'] = $result;

		return \rest_ensure_response( $data );
	}

	public static function api_send_mailchimp_campaign( $request ) {
		$id = $request['id'];
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
			'test_emails' => [
				'j.max.rabb@gmail.com',
				'jefferson.rabb@automattic.com',
			],
			'send_type' => 'html',
		];
		$result = $mc->post( "campaigns/$mc_campaign_id/actions/send", $payload );

		$data = self::retrieve_data( $id );
		$data['result'] = $result;

		return \rest_ensure_response( $data );
	}

	public static function retrieve_data( $id ) {
		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );
		$mc = new Mailchimp( self::mailchimp_api_key() );
		return [
			'lists'       => $mc->get( 'lists' ),
			'templates'   => $mc->get( 'templates' ),
			'campaign'    => $mc_campaign_id ? $mc->get( "campaigns/$mc_campaign_id" ) : null,
			'campaign_id' => $mc_campaign_id,
		];
	}

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

	public static function newsletter_published( $id, $post ) {

		$api_key = self::mailchimp_api_key();
		if ( ! $api_key ) {
			return;
		}
		$mc_campaign_id = get_post_meta( $id, 'mc_campaign_id', true );

		$mc = new Mailchimp( $api_key );
		$payload = [
			'type'       => 'regular',
			'content_type' => 'template',
			'settings'   => [
				'subject_line' => $post->post_title,
				'title' => $post->post_title,
				'from_name' => 'Jeff',
				'reply_to' => 'jeff@atavist.net',
			]
		];

		$campaign = $mc_campaign_id ? $mc->patch( "campaigns/$mc_campaign_id", $payload ) : $mc->post( "campaigns", $payload );
		$campaign_id = $campaign['id'];
		update_post_meta( $id, 'mc_campaign_id', $campaign_id );

		$blocks = parse_blocks( $post->post_content );
		$body   = sprintf( '<h1>%s</h1>', $post->post_title );
		foreach ( $blocks as $block ) {
			$body .= render_block( $block );
		}

		$templates = $mc->get( "templates" );

		$template_id = '364254';

		$template_data = $mc->get( "templates/$template_id" );

		error_log( json_encode( $template_data ) );

		$content_payload = [
			'html' => $body
		];

		$result = $mc->put( "campaigns/$campaign_id/content", $content_payload );

		// error_log( json_encode( $result ) );
	}
}
Newspack_Newsletters::instance();

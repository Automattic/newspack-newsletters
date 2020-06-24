<?php
/**
 * Service Provider: Mailchimp Implementation
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Main Newspack Newsletters Class.
 */
abstract class Newspack_Newsletters_Service_Provider implements Newspack_Newsletters_ESP_API_Interface, Newspack_Newsletters_WP_Hookable_Interface {

	/**
	 * Class constants.
	 */
	const BASE_NAMESPACE = 'newspack-newsletters/v1/';

	/**
	 * Class properties.
	 */

	/**
	 * Name of the service.
	 *
	 * @var string
	 */
	public $service;

	/**
	 * Instances of descendant service provider classes.
	 *
	 * @var array
	 */
	protected static $instances = [];

	/**
	 * Class constructor.
	 */
	public function __construct() {
		add_action( 'rest_api_init', [ $this, 'rest_api_init' ] );
		add_action( 'save_post_' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT, [ $this, 'save' ], 10, 3 );
		add_action( 'publish_' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT, [ $this, 'send' ], 10, 2 );
		add_action( 'wp_trash_post', [ $this, 'trash' ], 10, 1 );
	}

	/**
	 * Manage singleton instances of all descendant service provider classes.
	 */
	public static function instance() {
		if ( empty( self::$instances[ static::class ] ) ) {
			self::$instances[ static::class ] = new static();
		}
		return self::$instances[ static::class ];
	}

	/**
	 * Register API endpoints.
	 */
	public function rest_api_init() {
		\register_rest_route(
			self::BASE_NAMESPACE . $this->service,
			'(?P<id>[\a-z]+)',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'api_retrieve' ],
				'permission_callback' => [ $this, 'api_authoring_permissions_check' ],
				'args'                => [
					'id' => [
						'sanitize_callback' => 'absint',
						'validate_callback' => [ 'Newspack_Newsletters', 'validate_newsletter_id' ],
					],
				],
			]
		);
		\register_rest_route(
			self::BASE_NAMESPACE . $this->service,
			'(?P<id>[\a-z]+)/test',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'api_test' ],
				'permission_callback' => [ $this, 'api_authoring_permissions_check' ],
				'args'                => [
					'id'         => [
						'sanitize_callback' => 'absint',
						'validate_callback' => [ 'Newspack_Newsletters', 'validate_newsletter_id' ],
					],
					'test_email' => [
						'sanitize_callback' => 'sanitize_text_field',
					],
				],
			]
		);
		\register_rest_route(
			self::BASE_NAMESPACE . $this->service,
			'(?P<id>[\a-z]+)/sender',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'api_sender' ],
				'permission_callback' => [ $this, 'api_authoring_permissions_check' ],
				'args'                => [
					'id'        => [
						'sanitize_callback' => 'absint',
						'validate_callback' => [ 'Newspack_Newsletters', 'validate_newsletter_id' ],
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
	 * API callbacks.
	 */

	/**
	 * Set list for a campaign.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return WP_REST_Response|mixed API response or error.
	 */
	public function api_list( $request ) {
		$response = $this->list(
			$request['id'],
			$request['list_id']
		);
		return \rest_ensure_response( $response );
	}

	/**
	 * Get campaign data.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return WP_REST_Response|mixed API response or error.
	 */
	public function api_retrieve( $request ) {
		$response = $this->retrieve( $request['id'] );
		return \rest_ensure_response( $response );
	}

	/**
	 * Set the sender name and email for the campaign.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return WP_REST_Response|mixed API response or error.
	 */
	public function api_sender( $request ) {
		$response = $this->sender(
			$request['id'],
			$request['from_name'],
			$request['reply_to']
		);
		return \rest_ensure_response( $response );
	}

	/**
	 * Test campaign.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return WP_REST_Response|mixed API response or error.
	 */
	public function api_test( $request ) {
		$emails = explode( ',', $request['test_email'] );
		foreach ( $emails as &$email ) {
			$email = sanitize_email( trim( $email ) );
		}
		$response = $this->test(
			$request['id'],
			$emails
		);
		return \rest_ensure_response( $response );
	}

	/**
	 * Utility methods.
	 */

	/**
	 * Check capabilities for using the API for authoring tasks.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return bool|WP_Error
	 */
	public function api_authoring_permissions_check( $request ) {
		if ( ! current_user_can( 'edit_others_posts' ) ) {
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
}

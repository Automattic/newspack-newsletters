<?php
/**
 * Campaign Monitor ESP Service Controller.
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * API Controller for Newspack Campaign Monitor ESP service.
 */
class Newspack_Newsletters_Campaign_Monitor_Controller extends Newspack_Newsletters_Service_Provider_Controller {
	/**
	 * Newspack_Newsletters_Campaign_Monitor_Controller constructor.
	 *
	 * @param \Newspack_Newsletters_Campaign_Monitor $campaign_monitor The service provider class.
	 */
	public function __construct( $campaign_monitor ) {
		$this->service_provider = $campaign_monitor;
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
		parent::__construct( $campaign_monitor );
	}

	/**
	 * Register API endpoints unique to Campaign Monitor.
	 */
	public function register_routes() {

		// Register common ESP routes from \Newspack_Newsletters_Service_Provider_Controller::register_routes.
		parent::register_routes();

		// Note that this service provider uses an additional /retrieve endpoint because we need additional GET routes.
		\register_rest_route(
			$this->service_provider::BASE_NAMESPACE . $this->service_provider->service,
			'(?P<id>[\a-z]+)/retrieve',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'api_retrieve' ],
				'permission_callback' => [ $this->service_provider, 'api_authoring_permissions_check' ],
				'args'                => [
					'id' => [
						'sanitize_callback' => 'absint',
						'validate_callback' => [ 'Newspack_Newsletters', 'validate_newsletter_id' ],
					],
				],
			]
		);
		\register_rest_route(
			$this->service_provider::BASE_NAMESPACE . $this->service_provider->service,
			'(?P<id>[\a-z]+)/content',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'api_content' ],
				'permission_callback' => '__return_true',
			]
		);
		\register_rest_route(
			$this->service_provider::BASE_NAMESPACE . $this->service_provider->service,
			'(?P<id>[\a-z]+)/test',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ $this, 'api_test' ],
				'permission_callback' => [ $this->service_provider, 'api_authoring_permissions_check' ],
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
	}

	/**
	 * Get campaign data.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return WP_REST_Response|mixed API response or error.
	 */
	public function api_retrieve( $request ) {
		$response = $this->service_provider->retrieve( $request['id'], true );
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
		$response = $this->service_provider->test(
			$request['id'],
			$emails
		);
		return \rest_ensure_response( $response );
	}

	/**
	 * Get raw HTML for a campaign. Required for the Campaign Monitor API.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return void
	 */
	public function api_content( $request ) {
		$response = $this->service_provider->content(
			$request['id']
		);
		header( 'Content-Type: text/html; charset=UTF-8' );

		echo $response; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		exit();
	}
}

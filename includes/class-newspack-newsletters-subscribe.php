<?php
/**
 * Newspack Newsletters ESP-Agnostic Subscription Functionality
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Manages Settings Subscribe Class.
 */
class Newspack_Newsletters_Subscribe {

	const API_NAMESPACE = 'newspack-newsletters/v1';

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_api_endpoints' ] );
	}

	/**
	 * Register API endpoints.
	 */
	public static function register_api_endpoints() {
		register_rest_route(
			self::API_NAMESPACE,
			'/lists',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'api_get_lists' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	/**
	 * API method to retrieve lists available for subscription.
	 */
	public static function api_get_lists() {
		return \rest_ensure_response( self::get_lists() );
	}

	/**
	 * Get the lists available for subscription.
	 *
	 * @return array Lists.
	 */
	public static function get_lists() {
		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set' ) );
		}
		try {
			return $provider->get_lists();
		} catch ( \Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_get_lists',
				$e->getMessage()
			);
		}
		return [];
	}

	/**
	 * Add a contact to a list.
	 *
	 * @param string $email   Contact email.
	 * @param string $list_id List ID.
	 *
	 * @return bool|WP_Error Whether the contact was added or error.
	 */
	public static function add_contact( $email, $list_id ) {
		return false;
	}
}
Newspack_Newsletters_Subscribe::init();

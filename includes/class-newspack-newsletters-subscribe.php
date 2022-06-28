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
			$lists  = $provider->get_lists();
			$config = self::get_lists_config();
			return array_map(
				function( $list ) use ( $config ) {
					if ( ! isset( $list['id'], $list['name'] ) || empty( $list['id'] ) || empty( $list['name'] ) ) {
						return;
					}
					$item = [
						'id'          => $list['id'],
						'name'        => $list['name'],
						'active'      => false,
						'title'       => '',
						'description' => '',
					];
					if ( isset( $config[ $list['id'] ] ) ) {
						$list_config = $config[ $list['id'] ];
						$item        = array_merge(
							$item,
							[
								'active'      => $list_config['active'],
								'title'       => $list_config['title'],
								'description' => $list_config['description'],
							]
						);
					}
					return $item;
				},
				$lists
			);
		} catch ( \Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_get_lists',
				$e->getMessage()
			);
		}
		return [];
	}

	/**
	 * Get the lists configuration for the active provider.
	 *
	 * @return array[]|WP_Error Associative array with list configuration keyed by list ID or error.
	 */
	public static function get_lists_config() {
		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set' ) );
		}
		$provider_name = $provider->service;
		$option_name   = sprintf( '_newspack_newsletters_%s_lists', $provider_name );
		return get_option( $option_name, [] );
	}

	/**
	 * Update the lists settings.
	 *
	 * @param array[] $lists {
	 *    Array of list configuration.
	 *
	 *    @type string  id          The list id.
	 *    @type boolean active      Whether the list is available for subscription.
	 *    @type string  title       The list title.
	 *    @type string  description The list description.
	 * }
	 *
	 * @return boolean|WP_Error Whether the lists were updated or error.
	 */
	public static function update_lists( $lists ) {
		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set' ) );
		}
		$lists = self::sanitize_lists( $lists );
		if ( empty( $lists ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_lists', __( 'Invalid list configuration' ) );
		}
		$provider_name = $provider->service;
		$option_name   = sprintf( '_newspack_newsletters_%s_lists', $provider_name );
		return update_option( $option_name, $lists );
	}

	/**
	 * Sanitize an array of list configuration.
	 *
	 * @param array[] $lists Array of list configuration.
	 *
	 * @return array[] Sanitized associative array of list configuration keyed by the list ID.
	 */
	public static function sanitize_lists( $lists ) {
		$sanitized = [];
		foreach ( $lists as $list ) {
			if ( ! isset( $list['id'], $list['title'] ) || empty( $list['id'] ) || empty( $list['title'] ) ) {
				continue;
			}
			$sanitized[ $list['id'] ] = [
				'active'      => isset( $list['active'] ) ? (bool) $list['active'] : false,
				'title'       => $list['title'],
				'description' => isset( $list['description'] ) ? (string) $list['description'] : '',
			];
		}
		return $sanitized;
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

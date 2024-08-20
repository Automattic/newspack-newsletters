<?php
/**
 * Newspack Newsletters Send Lists.
 *
 * @package Newspack
 */

namespace Newspack\Newsletters;

use Newspack_Newsletters;
use Newspack_Newsletters_Settings;
use Newspack_Newsletters_Subscription;
use WP_Error;
use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Main Newspack Newsletters Send_Lists class.
 *
 * A Send_List is a collection of contacts which can be sent newsletter content.
 * A Send_List can be a top-level list or a sublist of a list.
 * Each Send_List corresponds to an entity in a supported ESP, but
 * shares the same data schema for interactions within this plugin.
 */
class Send_Lists {
	/**
	 * Initialize this class and register hooks.
	 *
	 * @return void
	 */
	public static function init() {
		if ( ! self::should_initialize_send_lists() ) {
			return;
		}

		add_action( 'rest_api_init', [ __CLASS__, 'register_api_endpoints' ] );
	}

	/**
	 * Check if we should initialize Send lists.
	 *
	 * @return boolean
	 */
	public static function should_initialize_send_lists() {
		// If Service Provider is not configured yet.
		if ( 'manual' === Newspack_Newsletters::service_provider() || ! Newspack_Newsletters::is_service_provider_configured() ) {
			return false;
		}

		return true;
	}

	/**
	 * Register the endpoints needed to fetch send lists.
	 */
	public static function register_api_endpoints() {
		register_rest_route(
			Newspack_Newsletters::API_NAMESPACE,
			'/send-lists',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'api_get_send_lists' ],
				'permission_callback' => [ 'Newspack_Newsletters', 'api_permission_callback' ],
				'args'                => [
					'search'    => [
						'type' => [ 'array', 'string' ],
					],
					'type'      => [
						'type' => 'string',
					],
					'parent_id' => [
						'type' => 'string',
					],
					'provider'  => [
						'type' => 'string',
					],
					'limit'     => [
						'type' => [ 'integer', 'string' ],
					],
				],
			]
		);
	}

	/**
	 * API handler to fetch send lists for the given provider.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 *
	 * @return WP_REST_Response|WP_Error WP_REST_Response on success, or WP_Error object on failure.
	 */
	public static function api_get_send_lists( $request ) {
		$search        = $request['search'] ?? null;
		$list_type     = $request['type'] ?? null;
		$parent_id     = $request['parent_id'] ?? null;
		$limit         = $request['limit'] ?? null;
		$provider_slug = $request['provider'] ?? null;
		$provider      = $provider_slug ? Newspack_Newsletters::get_service_provider_instance( $provider_slug ) : Newspack_Newsletters::get_service_provider();

		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Invalid provider, or provider not set.', 'newspack-newsletters' ) );
		}

		return \rest_ensure_response(
			$provider->get_send_lists( $search, $list_type, $parent_id, $limit )
		);
	}
}
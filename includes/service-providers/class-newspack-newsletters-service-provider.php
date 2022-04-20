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

	const BASE_NAMESPACE = 'newspack-newsletters/v1/';

	/**
	 * The controller.
	 *
	 * @var \WP_REST_Controller.
	 */
	private $controller;

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
		if ( $this->controller && $this->controller instanceof \WP_REST_Controller ) {
			add_action( 'rest_api_init', [ $this->controller, 'register_routes' ] );
		}
		add_action( 'pre_post_update', [ $this, 'pre_post_update' ], 10, 2 );
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
	 * Check capabilities for using the API for authoring tasks.
	 *
	 * @param WP_REST_Request $request API request object.
	 * @return bool|WP_Error
	 */
	public function api_authoring_permissions_check( $request ) {
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
	 * Handle newsletter post status changes.
	 *
	 * @param int   $post_id The post ID.
	 * @param array $data    Unslashed post data.
	 */
	public function pre_post_update( $post_id, $data ) {
		$post       = get_post( $post_id );
		$old_status = $post->post_status;
		$new_status = $data['post_status'];

		// Only run if it's a newsletter post.
		if ( ! Newspack_Newsletters::validate_newsletter_id( $post_id ) ) {
			return;
		}

		// Only run if this is the active provider.
		if ( Newspack_Newsletters::service_provider() !== $this->service ) {
			return;
		}

		// Send if changing from any status to publish.
		if ( 'publish' === $new_status && 'publish' !== $old_status ) {
			$result = $this->send_newsletter( $post );
			if ( is_wp_error( $result ) ) {
				$transient = sprintf( 'newspack_newsletters_error_%s_%s', $post->ID, get_current_user_id() );
				set_transient( $transient, $result->get_error_message(), 45 );
				wp_die( esc_html( $result->get_error_message() ) );
			}
		}

		// Prevent status change if newsletter has been sent.
		if (
			'publish' === $old_status &&
			'publish' !== $new_status &&
			get_post_meta( $post_id, '_newspack_newsletters_sent', true )
		) {
			wp_die( esc_html( __( 'You cannot change a sent newsletter status.', 'newspack-newsletters' ) ) );
		}
	}

	/**
	 * Send a newsletter.
	 *
	 * @param WP_Post $post The newsletter post.
	 *
	 * @return true|WP_Error True if successful, WP_Error if not.
	 */
	public function send_newsletter( $post ) {
		$post_id = $post->ID;

		// Newsletter was already sent.
		if ( get_post_meta( $post_id, '_newspack_newsletters_sent', true ) ) {
			return;
		}

		try {
			$result = $this->send( $post );
		} catch ( Exception $e ) {
			$result = new WP_Error( 'newspack_newsletter_error', $e->getMessage() );
		}

		if ( true === $result ) {
			update_post_meta( $post_id, '_newspack_newsletters_sent', time() );
		}

		return $result;
	}
}

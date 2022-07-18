<?php
/**
 * Newspack Newsletters ESP-Agnostic Subscription Functionality
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Manages Settings Subscription Class.
 */
class Newspack_Newsletters_Subscription {

	const API_NAMESPACE = 'newspack-newsletters/v1';

	const WC_ENDPOINT      = 'newsletters';
	const USER_FORM_ACTION = 'newspack_newsletters_subscription';

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_api_endpoints' ] );

		/** Subscription management through WC's "My Account".  */
		add_filter( 'woocommerce_get_query_vars', [ __CLASS__, 'add_query_var' ] );
		add_filter( 'woocommerce_account_menu_items', [ __CLASS__, 'add_menu_item' ], 20 );
		add_action( 'woocommerce_account_newsletters_endpoint', [ __CLASS__, 'endpoint_content' ] );
	}

	/**
	 * Register API endpoints.
	 */
	public static function register_api_endpoints() {
		register_rest_route(
			self::API_NAMESPACE,
			'/lists_config',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'api_get_lists_config' ],
				'permission_callback' => '__return_true',
			]
		);
		register_rest_route(
			self::API_NAMESPACE,
			'/lists',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'api_get_lists' ],
				'permission_callback' => [ __CLASS__, 'api_permission_callback' ],
			]
		);
		register_rest_route(
			self::API_NAMESPACE,
			'/lists',
			[
				'methods'             => \WP_REST_Server::EDITABLE,
				'callback'            => [ __CLASS__, 'api_update_lists' ],
				'permission_callback' => [ __CLASS__, 'api_permission_callback' ],
				'args'                => [
					'lists' => [
						'type'     => 'array',
						'required' => true,
						'items'    => [
							'type'       => 'object',
							'properties' => [
								'id'          => [
									'type' => 'string',
								],
								'active'      => [
									'type' => 'boolean',
								],
								'title'       => [
									'type' => 'string',
								],
								'description' => [
									'type' => 'string',
								],
							],
						],
					],
				],
			]
		);
	}

	/**
	 * Whether the current user can manage subscription lists.
	 *
	 * @return bool Whether the current user can manage subscription lists.
	 */
	public static function api_permission_callback() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * API method to retrieve the current lists configuration.
	 *
	 * @return WP_REST_Response|WP_Error WP_REST_Response on success, or WP_Error object on failure.
	 */
	public static function api_get_lists_config() {
		return \rest_ensure_response( self::get_lists_config() );
	}

	/**
	 * API method to retrieve the current ESP lists.
	 *
	 * @return WP_REST_Response|WP_Error WP_REST_Response on success, or WP_Error object on failure.
	 */
	public static function api_get_lists() {
		return \rest_ensure_response( self::get_lists() );
	}

	/**
	 * API method to update the list configuration.
	 *
	 * @param WP_REST_Request $request Full details about the request.
	 *
	 * @return WP_REST_Response|WP_Error WP_REST_Response on success, or WP_Error object on failure.
	 */
	public static function api_update_lists( $request ) {
		$update = self::update_lists( $request['lists'] );
		if ( is_wp_error( $update ) ) {
			return \rest_ensure_response( $update );
		}
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
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}
		try {
			$lists = $provider->get_lists();
			if ( is_wp_error( $lists ) ) {
				return $lists;
			}
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
						'title'       => $list['name'],
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
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}
		$provider_name = $provider->service;
		$option_name   = sprintf( '_newspack_newsletters_%s_lists', $provider_name );
		$config        = get_option( $option_name, [] );
		return array_filter(
			$config,
			function( $item ) {
				return true === isset( $item['active'] ) && (bool) $item['active'];
			}
		);
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
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}
		$lists = self::sanitize_lists( $lists );
		if ( empty( $lists ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_lists', __( 'Invalid list configuration.' ) );
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
	 * @param array    $contact {
	 *    Contact information.
	 *
	 *    @type string   $email    Contact email address.
	 *    @type string   $name     Contact name. Optional.
	 *    @type string[] $metadata Contact additional metadata. Optional.
	 * }
	 * @param string[] $lists   Array of list IDs to subscribe the contact to.
	 *
	 * @return bool|WP_Error Whether the contact was added or error.
	 */
	public static function add_contact( $contact, $lists = [] ) {
		if ( ! is_array( $lists ) ) {
			$lists = [ $lists ];
		}
		if ( empty( $lists ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_lists', __( 'No lists specified.' ) );
		}

		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}

		$errors = new WP_Error();

		foreach ( $lists as $list_id ) {
			try {
				$result = $provider->add_contact( $contact, $list_id );
			} catch ( \Exception $e ) {
				$errors->add( 'newspack_newsletters_add_contact', $e->getMessage() );
			}
			if ( is_wp_error( $result ) ) {
				$errors->add( $result->get_error_code(), $result->get_error_message() );
			}
		}
		$result = $errors->has_errors() ? $errors : $result;

		/**
		 * Fires after a contact is added.
		 *
		 * @param string        $provider The provider name.
		 * @param array         $contact  {
		 *    Contact information.
		 *
		 *    @type string   $email    Contact email address.
		 *    @type string   $name     Contact name. Optional.
		 *    @type string[] $metadata Contact additional metadata. Optional.
		 * }
		 * @param string[]      $lists    Array of list IDs to subscribe the contact to.
		 * @param bool|WP_Error $result   True if the contact was added or error if failed.
		 */
		do_action( 'newspack_newsletters_add_contact', $provider->service, $contact, $lists, $result );

		return $result;
	}

	/**
	 * Get a contact status.
	 *
	 * @param string $email The contact email.
	 *
	 * @return string[]|false|WP_Error Contact subscribed list names keyed by ID, false if not found or error.
	 */
	public static function get_contact_lists( $email ) {
		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}
		return $provider->get_contact_lists( $email );
	}

	/**
	 * Add query var
	 *
	 * @param array $vars Query var.
	 *
	 * @return array
	 */
	public static function add_query_var( $vars ) {
		$vars[] = self::WC_ENDPOINT;
		return $vars;
	}

	/**
	 * Insert the new endpoint into the My Account menu.
	 *
	 * @param array $menu_items Menu items.
	 *
	 * @return array
	 */
	public static function add_menu_item( $menu_items ) {
		$position       = -1;
		$menu_item_name = __( 'Newsletters', 'newspack-newsletters' );
		return array_slice( $menu_items, 0, $position, true ) + [ self::WC_ENDPOINT => $menu_item_name ] + array_slice( $menu_items, $position, null, true );
	}

	/**
	 * Endpoint content.
	 */
	public static function endpoint_content() {
		$email       = get_userdata( get_current_user_id() )->user_email;
		$list_config = self::get_lists_config();
		$list_map    = [];
		$user_lists  = array_flip( self::get_contact_lists( $email ) );
		?>
		<div class="newspack-newsletters__user-subscription">
			<p>
				<?php _e( 'Manage the newsletters you are subscribed to.', 'newspack-newsletters' ); ?>
			</p>
			<form method="post">
				<?php wp_nonce_field( self::USER_FORM_ACTION ); ?>
				<ul>
					<?php
					foreach ( $list_config as $list_id => $list ) :
						$checkbox_id = sprintf( 'newspack-%s-list-checkbox-%s', $block_id, $list_id );
						?>
						<li>
							<span class="newspack-newsletters__lists__checkbox">
								<input
									type="checkbox"
									name="lists[]"
									value="<?php echo \esc_attr( $list_id ); ?>"
									id="<?php echo \esc_attr( $checkbox_id ); ?>"
									<?php if ( isset( $user_lists[ $list_id ] ) ) : ?>
										checked
									<?php endif; ?>
								/>
							</span>
							<span class="newspack-newsletters__lists__details">
								<label class="newspack-newsletters__lists__label" for="<?php echo \esc_attr( $checkbox_id ); ?>">
									<span class="newspack-newsletters__lists__title">
										<?php echo \esc_html( $list['title'] ); ?>
									</span>
									<span class="newspack-newsletters__lists__description"><?php echo \esc_html( $list['description'] ); ?></span>
								</label>
							</span>
						</li>
					<?php endforeach; ?>
				</ul>
				<button type="submit"><?php _e( 'Update subscriptions', 'newspack-newsletters' ); ?></button>
			</form>
		</div>
		<?php
	}
}
Newspack_Newsletters_Subscription::init();

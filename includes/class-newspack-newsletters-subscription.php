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

	const EMAIL_VERIFIED_META    = 'newspack_newsletters_email_verified';
	const EMAIL_VERIFIED_REQUEST = 'newspack_newsletters_email_verification_request';
	const EMAIL_VERIFIED_CONFIRM = 'newspack_newsletters_email_verification';

	const WC_ENDPOINT         = 'newsletters';
	const SUBSCRIPTION_UPDATE = 'newspack_newsletters_subscription';

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_api_endpoints' ] );
		add_action( 'newspack_registered_reader', [ __CLASS__, 'newspack_registered_reader' ], 10, 5 );

		/** User email verification for subscription management. */
		add_action( 'resetpass_form', [ __CLASS__, 'set_current_user_email_verified' ] );
		add_action( 'password_reset', [ __CLASS__, 'set_current_user_email_verified' ] );
		add_action( 'newspack_magic_link_authenticated', [ __CLASS__, 'set_current_user_email_verified' ] );
		add_action( 'newspack_reader_verified', [ __CLASS__, 'set_user_email_verified' ] );
		add_action( 'template_redirect', [ __CLASS__, 'process_email_verification_request' ] );
		add_action( 'template_redirect', [ __CLASS__, 'process_email_verification' ] );

		/** Subscription management through WC's "My Account".  */
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_scripts' ] );
		add_filter( 'woocommerce_get_query_vars', [ __CLASS__, 'add_query_var' ] );
		add_filter( 'woocommerce_account_menu_items', [ __CLASS__, 'add_menu_item' ], 20 );
		add_action( 'woocommerce_account_newsletters_endpoint', [ __CLASS__, 'endpoint_content' ] );
		add_action( 'template_redirect', [ __CLASS__, 'process_subscription_update' ] );
		add_action( 'init', [ __CLASS__, 'flush_rewrite_rules' ] );
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
	 * @return array|WP_Error Lists or error.
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
	 * Whether the current provider setup support subscription management.
	 *
	 * @return boolean
	 */
	public static function has_subscription_management() {
		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return false;
		}
		if ( ! method_exists( $provider, 'get_contact_lists' ) || ! method_exists( $provider, 'update_contact_lists' ) ) {
			return false;
		}
		return true;
	}

	/**
	 * Get contact data by email.
	 *
	 * @param string $email_address Email address.
	 * @param bool   $return_details Fetch full contact data.
	 *
	 * @return array|WP_Error Response or error.
	 */
	public static function get_contact_data( $email_address, $return_details = false ) {
		if ( ! $email_address || empty( $email_address ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_email', __( 'Missing email address.' ) );
		}

		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}

		if ( ! method_exists( $provider, 'get_contact_data' ) ) {
			return new WP_Error( 'newspack_newsletters_not_implemented', __( 'Provider does not handle the contact-exists check.' ) );
		}

		return $provider->get_contact_data( $email_address, $return_details );
	}

	/**
	 * Upserts a contact to lists.
	 *
	 * @param array          $contact {
	 *          Contact information.
	 *
	 *    @type string   $email    Contact email address.
	 *    @type string   $name     Contact name. Optional.
	 *    @type string[] $metadata Contact additional metadata. Optional.
	 * }
	 * @param string[]|false $lists   Array of list IDs to subscribe the contact to. If empty or false, contact will be created but not subscribed to any lists.
	 *
	 * @return array|WP_Error Contact data if it was added, or error otherwise.
	 */
	public static function add_contact( $contact, $lists = false ) {
		if ( ! is_array( $lists ) && false !== $lists ) {
			$lists = [ $lists ];
		}

		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}

		if ( false !== $lists ) {
			Newspack_Newsletters_Logger::log( 'Adding contact to list(s): ' . implode( ', ', $lists ) . '. Provider is ' . $provider->service . '.' );
		} else {
			Newspack_Newsletters_Logger::log( 'Adding contact without lists. Provider is ' . $provider->service . '.' );
		}

		$existing_contact                 = self::get_contact_data( $contact['email'], true );
		$contact['existing_contact_data'] = \is_wp_error( $existing_contact ) ? false : $existing_contact;

		/**
		 * Filters the contact before passing on to the API.
		 *
		 * @param array          $contact           {
		 *          Contact information.
		 *
		 *    @type string   $email                 Contact email address.
		 *    @type string   $name                  Contact name. Optional.
		 *    @type string   $existing_contact_data Existing contact data, if updating a contact. The hook will be also called when
		 *    @type string[] $metadata              Contact additional metadata. Optional.
		 * }
		 * @param string[]|false $selected_list_ids Array of list IDs the contact will be subscribed to, or false.
		 * @param string         $provider          The provider name.
		 */
		$contact = apply_filters( 'newspack_newsletters_contact_data', $contact, $lists, $provider->service );

		/**
		 * Filters the contact selected lists before passing on to the API.
		 *
		 * @param string[]|false $lists    Array of list IDs the contact will be subscribed to, or false.
		 * @param array          $contact  {
		 *          Contact information.
		 *
		 *    @type string   $email    Contact email address.
		 *    @type string   $name     Contact name. Optional.
		 *    @type string[] $metadata Contact additional metadata. Optional.
		 * }
		 * @param string         $provider          The provider name.
		 */
		$lists = apply_filters( 'newspack_newsletters_contact_lists', $lists, $contact, $provider->service );

		$errors = new WP_Error();

		if ( empty( $lists ) ) {
			try {
				$result = $provider->add_contact( $contact );
			} catch ( \Exception $e ) {
				$errors->add( 'newspack_newsletters_subscription_add_contact', $e->getMessage() );
			}
		} else {
			foreach ( $lists as $list_id ) {
				try {
					$result = $provider->add_contact( $contact, $list_id );
				} catch ( \Exception $e ) {
					$errors->add( 'newspack_newsletters_subscription_add_contact', $e->getMessage() );
				}
			}
		}
		if ( is_wp_error( $result ) ) {
			$errors->add( $result->get_error_code(), $result->get_error_message() );
		}
		$result = $errors->has_errors() ? $errors : $result;

		/**
		 * Fires after a contact is added.
		 *
		 * @param string              $provider The provider name.
		 * @param array               $contact  {
		 *    Contact information.
		 *
		 *    @type string   $email    Contact email address.
		 *    @type string   $name     Contact name. Optional.
		 *    @type string[] $metadata Contact additional metadata. Optional.
		 * }
		 * @param string[]|false      $lists    Array of list IDs to subscribe the contact to.
		 * @param bool|WP_Error       $result   True if the contact was added or error if failed.
		 */
		do_action( 'newspack_newsletters_add_contact', $provider->service, $contact, $lists, $result );

		return $result;
	}

	/**
	 * Add a contact to ESP when a reader is registered.
	 *
	 * @param string         $email         Email address.
	 * @param bool           $authenticate  Whether to authenticate after registering.
	 * @param false|int      $user_id       The created user id.
	 * @param false|\WP_User $existing_user The existing user object.
	 * @param array          $metadata      Metadata.
	 */
	public static function newspack_registered_reader( $email, $authenticate, $user_id, $existing_user, $metadata ) {
		if ( isset( $metadata['lists'] ) && ! empty( $metadata['lists'] ) ) {
			$lists = $metadata['lists'];
			unset( $metadata['lists'] );
		} else {
			$lists = false;
		}
		// Adding is actually upserting, so no need to check if the hook is called for an existing user.
		self::add_contact(
			[
				'email'    => $email,
				'metadata' => $metadata,
			],
			$lists
		);
	}

	/**
	 * Update a contact lists subscription.
	 *
	 * This method will remove the contact from all subscription lists and add
	 * them to the specified lists.
	 *
	 * @param string   $email Contact email address.
	 * @param string[] $lists Array of list IDs to subscribe the contact to.
	 *
	 * @return bool|WP_Error Whether the contact was updated or error.
	 */
	private static function update_contact_lists( $email, $lists = [] ) {
		if ( ! self::has_subscription_management() ) {
			return new WP_Error( 'newspack_newsletters_not_supported', __( 'Not supported for this provider', 'newspack-newsletters' ) );
		}
		$provider = Newspack_Newsletters::get_service_provider();

		Newspack_Newsletters_Logger::log( 'Updating lists of a contact. List selection: ' . implode( ', ', $lists ) . '. Provider is ' . $provider->service . '.' );

		/** Determine lists to add/remove from existing list config. */
		$lists_config    = self::get_lists_config();
		$lists_to_add    = array_intersect( array_keys( $lists_config ), $lists );
		$lists_to_remove = array_diff( array_keys( $lists_config ), $lists );

		/** Clean up lists to add/remove from contact's existing data. */
		$current_lists   = self::get_contact_lists( $email );
		$lists_to_add    = array_diff( $lists_to_add, $current_lists );
		$lists_to_remove = array_intersect( $current_lists, $lists_to_remove );

		if ( empty( $lists_to_add ) && empty( $lists_to_remove ) ) {
			return false;
		}

		$result = $provider->update_contact_lists( $email, $lists_to_add, $lists_to_remove );

		/**
		 * Fires after a contact's lists are updated.
		 *
		 * @param string        $provider        The provider name.
		 * @param string        $email           Contact email address.
		 * @param string[]      $lists_to_add    Array of list IDs to subscribe the contact to.
		 * @param string[]      $lists_to_remove Array of list IDs to remove the contact from.
		 * @param bool|WP_Error $result          True if the contact was updated or error if failed.
		 */
		do_action( 'newspack_newsletters_update_contact_lists', $provider->service, $email, $lists_to_add, $lists_to_remove, $result );

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
		if ( ! self::has_subscription_management() ) {
			return new WP_Error( 'newspack_newsletters_not_supported', __( 'Not supported for this provider', 'newspack-newsletters' ) );
		}
		return Newspack_Newsletters::get_service_provider()->get_contact_lists( $email );
	}

	/**
	 * Whether the current user has its email verified in order to manage their
	 * newletters subscriptions.
	 *
	 * @param int    $user_id User ID. Default is the current user ID.
	 * @param string $email   Email address being verified. Default is the current user email.
	 *
	 * @return bool
	 */
	public static function is_email_verified( $user_id = 0, $email = '' ) {
		if ( empty( $user_id ) ) {
			$user_id = get_current_user_id();
		}
		if ( ! $user_id ) {
			return false;
		}

		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) {
			return false;
		}

		if ( empty( $email ) ) {
			$email = $user->user_email;
		}

		$verified_emails = get_user_meta( $user_id, self::EMAIL_VERIFIED_META, true );
		if ( ! is_array( $verified_emails ) ) {
			$verified_emails = [];
		}

		$verified = in_array( $email, $verified_emails, true );

		/**
		 * Filters whether the current user has its email verified.
		 *
		 * @param bool    $verified Whether the current user has its email verified.
		 * @param WP_User $user     User object.
		 * @param string  $email    Email address being verified.
		 */
		return (bool) apply_filters( 'newspack_newsletters_is_email_verified', $verified, $user, $email );
	}

	/**
	 * Set email as verified for a user.
	 *
	 * @param int    $user_id User ID.
	 * @param string $email   Email address being verified. Default is the current user's email.
	 *
	 * @return bool Wether the email was marked as verified successfully.
	 */
	public static function set_email_verified( $user_id, $email = '' ) {
		$verified_emails = get_user_meta( $user_id, self::EMAIL_VERIFIED_META, true );
		if ( ! is_array( $verified_emails ) ) {
			$verified_emails = [];
		}
		if ( empty( $email ) ) {
			$email = get_user_by( 'id', $user_id )->user_email;
		}
		if ( ! in_array( $email, $verified_emails, true ) ) {
			$verified_emails[] = $email;
			return update_user_meta( $user_id, self::EMAIL_VERIFIED_META, $verified_emails );
		}
		return false;
	}

	/**
	 * Set the user's email as verified.
	 *
	 * @param WP_User $user User.
	 */
	public static function set_user_email_verified( $user ) {
		if ( ! $user instanceof WP_User ) {
			return;
		}
		self::set_email_verified( $user->ID, $user->user_email );
	}

	/**
	 * Set current user's email as verified.
	 */
	public static function set_current_user_email_verified() {
		if ( ! is_user_logged_in() ) {
			return;
		}
		self::set_user_email_verified( wp_get_current_user() );
	}

	/**
	 * Get current user email verification transient key.
	 *
	 * @param string $email Email address being verified. Default is the current user's email.
	 */
	private static function get_email_verification_transient_key( $email = '' ) {
		$user_id = get_current_user_id();
		if ( empty( $email ) ) {
			$email = get_user_by( 'id', $user_id )->user_email;
		}
		return sprintf( 'newspack_newsletters_email_verification_%s_%s', $user_id, wp_hash( $email ) );
	}

	/**
	 * Process request to verify a user's email.
	 *
	 * A 1-day transient will hold a token to verify the email.
	 */
	public static function process_email_verification_request() {
		if ( ! isset( $_GET[ self::EMAIL_VERIFIED_REQUEST ] ) || ! wp_verify_nonce( sanitize_text_field( $_GET[ self::EMAIL_VERIFIED_REQUEST ] ), self::EMAIL_VERIFIED_REQUEST ) ) {
			return;
		}

		if ( ! is_user_logged_in() ) {
			wp_die( esc_html( __( 'Invalid request.', 'newspack-newsletters' ) ) );
		}

		$user               = wp_get_current_user();
		$transient_key      = self::get_email_verification_transient_key();
		$token              = \wp_generate_password( 43, false, false );
		$verification_nonce = wp_create_nonce( self::EMAIL_VERIFIED_CONFIRM );

		$url = home_url();
		if ( function_exists( 'wc_get_account_endpoint_url' ) ) {
			$url = wc_get_account_endpoint_url( 'newsletters' );
		}
		$url = add_query_arg(
			[
				self::EMAIL_VERIFIED_CONFIRM => $verification_nonce,
				'token'                      => $token,
			],
			$url
		);

		set_transient( $transient_key, $token, DAY_IN_SECONDS );

		$blogname = wp_specialchars_decode( get_option( 'blogname' ), ENT_QUOTES );

		$switched_locale = switch_to_locale( get_user_locale( $user ) );

		/* translators: %s: User display name. */
		$message  = sprintf( __( 'Hello, %s!', 'newspack-newsletters' ), $user->display_name ) . "\r\n\r\n";
		$message .= __( 'Verify your email address by visiting the following address:', 'newspack-newsletters' ) . "\r\n\r\n";
		$message .= $url . "\r\n";
		$headers  = '';

		if ( method_exists( '\Newspack\Reader_Activation', 'get_from_email' ) && method_exists( '\Newspack\Reader_Activation', 'get_from_name' ) ) {
			$headers = [
				sprintf(
					'From: %1$s <%2$s>',
					\Newspack\Reader_Activation::get_from_name(),
					\Newspack\Reader_Activation::get_from_email()
				),
			];
		}

		$email = [
			'to'      => $user->user_email,
			/* translators: %s Site title. */
			'subject' => __( '[%s] Verify your email', 'newspack' ),
			'message' => $message,
			'headers' => $headers,
		];

		/**
		 * Filters the email verification email.
		 *
		 * @param array    $email          Email arguments. {
		 *   Used to build wp_mail().
		 *
		 *   @type string $to      The intended recipient - New user email address.
		 *   @type string $subject The subject of the email.
		 *   @type string $message The body of the email.
		 *   @type string $headers The headers of the email.
		 * }
		 * @param \WP_User $user           User to send the magic link to.
		 * @param string   $magic_link_url Magic link url.
		 */
		$email = \apply_filters( 'newspack_newsletters_email_verification_email', $email, $user, $url );

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_mail_wp_mail
		$sent = \wp_mail(
			$email['to'],
			\wp_specialchars_decode( sprintf( $email['subject'], $blogname ) ),
			$email['message'],
			$email['headers']
		);

		if ( $switched_locale ) {
			\restore_previous_locale();
		}

		if ( function_exists( 'wc_add_notice' ) ) {
			wc_add_notice( __( 'Check your email address for a verification link.', 'newspack-newsletters' ), 'success' );
		}
		wp_safe_redirect( add_query_arg( [ 'verification_sent' => 1 ], remove_query_arg( self::EMAIL_VERIFIED_REQUEST, wp_get_referer() ) ) );
		exit;
	}

	/**
	 * Process email verification.
	 */
	public static function process_email_verification() {
		if ( ! isset( $_GET[ self::EMAIL_VERIFIED_CONFIRM ] ) || ! wp_verify_nonce( sanitize_text_field( $_GET[ self::EMAIL_VERIFIED_CONFIRM ] ), self::EMAIL_VERIFIED_CONFIRM ) ) {
			return;
		}
		if ( ! is_user_logged_in() ) {
			wp_die( esc_html( __( 'You\'re not logged in.', 'newspack-newsletters' ) ) );
		}
		$transient_key = self::get_email_verification_transient_key();
		$token         = get_transient( $transient_key );
		if ( ! $token ) {
			wp_die( esc_html( __( 'Invalid request.', 'newspack-newsletters' ) ) );
		}
		if ( ! isset( $_GET['token'] ) || sanitize_text_field( $_GET['token'] ) !== $token ) {
			wp_die( esc_html( __( 'Invalid request.', 'newspack-newsletters' ) ) );
		}

		self::set_email_verified( get_current_user_id() );

		delete_transient( $transient_key );

		if ( function_exists( 'wc_add_notice' ) ) {
			wc_add_notice( __( 'Your email has been verified.', 'newspack-newsletters' ), 'success' );
		}
		wp_safe_redirect( remove_query_arg( [ self::EMAIL_VERIFIED_CONFIRM, 'token' ] ) );
		exit;
	}

	/**
	 * Enqueue subscription lists scripts and styles.
	 */
	public static function enqueue_scripts() {
		wp_enqueue_style(
			'newspack-newsletters-subscriptions',
			plugins_url( '../dist/subscriptions.css', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/subscriptions.css' )
		);
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
	 * Flush rewrite rules for WC_ENDPOINT.
	 */
	public static function flush_rewrite_rules() {
		$option_name = 'newspack_newsletters_has_flushed_rewrite_rules';
		if ( ! get_option( $option_name ) ) {
			flush_rewrite_rules(); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.flush_rewrite_rules_flush_rewrite_rules
			update_option( $option_name, true );
		}
	}

	/**
	 * Insert the new endpoint into the My Account menu.
	 *
	 * @param array $menu_items Menu items.
	 *
	 * @return array
	 */
	public static function add_menu_item( $menu_items ) {
		if ( ! self::has_subscription_management() ) {
			return $menu_items;
		}
		$position       = -1;
		$menu_item_name = __( 'Newsletters', 'newspack-newsletters' );
		return array_slice( $menu_items, 0, $position, true ) + [ self::WC_ENDPOINT => $menu_item_name ] + array_slice( $menu_items, $position, null, true );
	}

	/**
	 * Endpoint content.
	 */
	public static function endpoint_content() {
		if ( ! self::has_subscription_management() ) {
			return;
		}
		$user_id  = get_current_user_id();
		$email    = get_userdata( $user_id )->user_email;
		$verified = self::is_email_verified();
		?>
		<div class="newspack-newsletters__user-subscription">
			<?php if ( ! $verified && ! isset( $_GET['verification_sent'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
				<p>
					<?php esc_html_e( 'Please verify your email address before managing your newsletters subscriptions.', 'newspack-newsletters' ); ?>
				</p>
				<p>
					<a href="<?php echo esc_url( wp_nonce_url( remove_query_arg( self::EMAIL_VERIFIED_REQUEST ), self::EMAIL_VERIFIED_REQUEST, self::EMAIL_VERIFIED_REQUEST ) ); ?>" class="button button-primary">
						<?php esc_html_e( 'Verify Email', 'newspack-newsletters' ); ?>
					</a>
				</p>
			<?php endif; ?>
			<?php
			if ( $verified ) :
				$list_config = self::get_lists_config();
				$list_map    = [];
				$user_lists  = array_flip( self::get_contact_lists( $email ) );
				?>
				<p>
					<?php _e( 'Manage your newsletter preferences.', 'newspack-newsletters' ); ?>
				</p>
				<form method="post">
					<?php wp_nonce_field( self::SUBSCRIPTION_UPDATE, self::SUBSCRIPTION_UPDATE ); ?>
					<div class="newspack-newsletters__lists">
						<ul>
							<?php
							foreach ( $list_config as $list_id => $list ) :
								$checkbox_id = sprintf( 'newspack-newsletters-list-checkbox-%s', $list_id );
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
					</div>
					<button type="submit"><?php _e( 'Update subscriptions', 'newspack-newsletters' ); ?></button>
				</form>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Process user newsletters subscription update.
	 */
	public static function process_subscription_update() {
		if ( ! isset( $_POST[ self::SUBSCRIPTION_UPDATE ] ) || ! wp_verify_nonce( sanitize_text_field( $_POST[ self::SUBSCRIPTION_UPDATE ] ), self::SUBSCRIPTION_UPDATE ) ) {
			return;
		}
		if ( ! self::has_subscription_management() ) {
			return;
		}
		if ( ! is_user_logged_in() || ! self::is_email_verified() ) {
			wc_add_notice( __( 'You must be logged in and verified to update your subscriptions.', 'newspack-newsletters' ), 'error' );
		} else {
			$email  = get_userdata( get_current_user_id() )->user_email;
			$lists  = isset( $_POST['lists'] ) ? array_map( 'sanitize_text_field', $_POST['lists'] ) : [];
			$result = self::update_contact_lists( $email, $lists );
			if ( is_wp_error( $result ) ) {
				wc_add_notice( $result->get_error_message(), 'error' );
			} elseif ( false === $result ) {
				wc_add_notice( __( 'You must select newsletters to update.', 'newspack-newsletters' ), 'error' );
			} else {
				wc_add_notice( __( 'Your subscriptions were updated.', 'newspack-newsletters' ), 'success' );
			}
		}
	}
}
Newspack_Newsletters_Subscription::init();

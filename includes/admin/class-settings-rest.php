<?php
/**
 * REST surface for the standalone-mode Settings screen.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

use Newspack_Newsletters;
use Newspack_Newsletters_Settings;
use WP_Error;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Settings REST controller.
 */
class Settings_REST {
	const API_NAMESPACE = 'newspack-newsletters/v1';
	const ROUTE         = 'admin-shell/settings';

	/**
	 * Allowlist of credential fields exposed to the React shell, keyed by
	 * provider slug. Constant Contact's `api_credentials()` also returns
	 * `access_token` / `refresh_token` — long-lived OAuth secrets that
	 * never need to leave the server.
	 */
	const PROVIDER_CREDENTIAL_ALLOWLIST = [
		'mailchimp'        => [ 'api_key' ],
		'constant_contact' => [ 'api_key', 'api_secret' ],
		'active_campaign'  => [ 'url', 'key' ],
	];

	/**
	 * Settings-list option keys that are managed by the provider /
	 * credentials section, not the cross-cutting options section. These
	 * skip the options schema so `get_settings_list()`'s provider-scoped
	 * *non-credential* entries (e.g. `newspack_mailchimp_auto_append_footer`)
	 * still surface as options.
	 */
	const PROVIDER_CREDENTIAL_OPTION_KEYS = [
		'newspack_mailchimp_api_key',
		'newspack_newsletters_constant_contact_api_key',
		'newspack_newsletters_constant_contact_api_secret',
		'newspack_newsletters_active_campaign_url',
		'newspack_newsletters_active_campaign_key',
	];

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ] );
	}

	/**
	 * Register the GET/POST pair.
	 */
	public static function register_routes() {
		register_rest_route(
			self::API_NAMESPACE,
			'/' . self::ROUTE,
			[
				[
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => [ __CLASS__, 'get_settings' ],
					'permission_callback' => [ __CLASS__, 'permission_check' ],
				],
				[
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => [ __CLASS__, 'update_settings' ],
					'permission_callback' => [ __CLASS__, 'permission_check' ],
					'args'                => [
						'provider' => [
							'type' => 'object',
						],
						'options'  => [
							'type' => 'object',
						],
					],
				],
			]
		);
	}

	/**
	 * Capability gate.
	 *
	 * @param \WP_REST_Request $request Incoming request.
	 * @return bool|\WP_Error
	 */
	public static function permission_check( $request ) {
		return Newspack_Newsletters::api_administration_permissions_check( $request );
	}

	/**
	 * Return the aggregated payload for a fresh page mount.
	 *
	 * @return \WP_REST_Response
	 */
	public static function get_settings() {
		return rest_ensure_response( self::build_payload() );
	}

	/**
	 * Persist provider/credentials/options from the payload and return the refreshed view.
	 *
	 * @param \WP_REST_Request $request Incoming request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public static function update_settings( $request ) {
		$errors = new WP_Error();

		$provider_payload = $request->get_param( 'provider' );
		if ( is_array( $provider_payload ) && array_key_exists( 'slug', $provider_payload ) ) {
			$slug          = is_string( $provider_payload['slug'] ) ? $provider_payload['slug'] : '';
			$previous_slug = Newspack_Newsletters::service_provider();
			$valid_slugs   = array_merge( [ 'manual' ], Newspack_Newsletters::get_supported_providers() );
			if ( '' === $slug ) {
				$errors->add(
					'newspack_newsletters_no_service_provider',
					__( 'Please select a newsletter service provider.', 'newspack-newsletters' ),
					[ 'status' => 400 ]
				);
			} elseif ( ! in_array( $slug, $valid_slugs, true ) ) {
				$errors->add(
					'newspack_newsletters_invalid_provider',
					__( 'Unknown service provider.', 'newspack-newsletters' ),
					[ 'status' => 400 ]
				);
			} else {
				Newspack_Newsletters::set_service_provider( $slug );
				if ( 'manual' !== $slug ) {
					$credentials = isset( $provider_payload['credentials'] ) && is_array( $provider_payload['credentials'] )
						? $provider_payload['credentials']
						: [];
					if ( empty( $credentials ) ) {
						$errors->add(
							'newspack_newsletters_invalid_keys',
							__( 'Please input credentials.', 'newspack-newsletters' ),
							[ 'status' => 400 ]
						);
					} else {
						$provider = Newspack_Newsletters::get_service_provider();
						if ( $provider && method_exists( $provider, 'set_api_credentials' ) ) {
							$result = $provider->set_api_credentials( self::merge_credentials( $slug, $credentials, $provider ) );
							if ( is_wp_error( $result ) ) {
								foreach ( $result->errors as $code => $messages ) {
									$errors->add( $code, implode( ' ', $messages ), [ 'status' => 400 ] );
								}
							}
						}
					}
				}
				// Restore the previous provider if anything in the provider
				// switch failed, so a rejected request doesn't leave the
				// site pointing at an unconfigured provider.
				if ( $errors->has_errors() && $previous_slug && $previous_slug !== $slug ) {
					Newspack_Newsletters::set_service_provider( $previous_slug );
				}
			}
		}

		// If the provider half of the payload errored, don't proceed to
		// options — partial-write semantics (provider rejected, options
		// committed) are confusing for the client.
		if ( $errors->has_errors() ) {
			return $errors;
		}

		$options_payload = $request->get_param( 'options' );
		if ( is_array( $options_payload ) ) {
			$schema   = self::get_options_schema();
			$to_write = [];
			foreach ( $options_payload as $key => $value ) {
				if ( ! isset( $schema[ $key ] ) ) {
					continue;
				}
				$to_write[ $key ] = self::sanitize_option_value( $value, $schema[ $key ] );
			}
			if ( ! empty( $to_write ) ) {
				Newspack_Newsletters_Settings::update_settings( $to_write );
			}
		}

		return rest_ensure_response( self::build_payload() );
	}

	/**
	 * Aggregate provider state, supported providers, OAuth state, and options.
	 *
	 * @return array
	 */
	private static function build_payload() {
		$provider_slug = Newspack_Newsletters::service_provider();
		$provider      = Newspack_Newsletters::get_service_provider();

		$credentials_set = [];
		$has_creds       = false;
		if ( $provider && method_exists( $provider, 'api_credentials' ) ) {
			$credentials_set = self::credentials_set_flags( $provider_slug, $provider->api_credentials() );
			if ( method_exists( $provider, 'has_api_credentials' ) ) {
				$has_creds = (bool) $provider->has_api_credentials();
			}
		}

		$is_manual = 'manual' === $provider_slug;
		$status    = $is_manual || ( $provider && $has_creds );

		$oauth = null;
		if ( $provider && method_exists( $provider, 'verify_token' ) ) {
			$token = $provider->verify_token( true );
			if ( is_array( $token ) ) {
				$oauth = [
					'valid'    => ! empty( $token['valid'] ),
					'auth_url' => isset( $token['auth_url'] ) ? (string) $token['auth_url'] : '',
				];
			}
		}

		$schema  = self::get_options_schema();
		$options = [];
		foreach ( $schema as $key => $field ) {
			$options[ $key ] = get_option( $key, $field['default'] );
			if ( 'checkbox' === $field['type'] ) {
				$options[ $key ] = (bool) $options[ $key ];
			}
		}

		return [
			'provider'  => [
				'selected'        => $provider_slug ? $provider_slug : '',
				'credentials_set' => $credentials_set,
				'status'          => (bool) $status,
				'oauth'           => $oauth,
			],
			'providers' => self::get_provider_choices(),
			'options'   => $options,
			'schema'    => array_values( $schema ),
		];
	}

	/**
	 * Build the provider selector choices.
	 *
	 * @return array
	 */
	private static function get_provider_choices() {
		$choices = [
			[
				'slug' => '',
				'name' => __( 'Select service provider', 'newspack-newsletters' ),
			],
		];

		$supported = Newspack_Newsletters::get_supported_providers();
		foreach ( Newspack_Newsletters::get_registered_providers() as $slug => $config ) {
			if ( ! in_array( $slug, $supported, true ) ) {
				continue;
			}
			$choices[] = [
				'slug' => $slug,
				'name' => $config['name'],
			];
		}

		$choices[] = [
			'slug' => 'manual',
			'name' => __( 'Manual / Other', 'newspack-newsletters' ),
		];

		return $choices;
	}

	/**
	 * Build the options whitelist plus tracking keys (which live outside `get_settings_list()`).
	 *
	 * @return array
	 */
	private static function get_options_schema() {
		$schema = [];

		foreach ( Newspack_Newsletters_Settings::get_settings_list() as $entry ) {
			$key = isset( $entry['key'] ) ? $entry['key'] : null;
			if ( ! $key || 'newspack_newsletters_service_provider' === $key ) {
				continue;
			}
			if ( in_array( $key, self::PROVIDER_CREDENTIAL_OPTION_KEYS, true ) ) {
				continue;
			}
			$type = isset( $entry['type'] ) ? $entry['type'] : 'text';
			if ( in_array( $type, [ 'boolean', 'bool' ], true ) ) {
				$type = 'checkbox';
			}
			$schema[ $key ] = [
				'key'         => $key,
				'label'       => isset( $entry['description'] ) ? $entry['description'] : $key,
				'type'        => $type,
				'default'     => array_key_exists( 'default', $entry ) ? $entry['default'] : '',
				'help'        => isset( $entry['help'] ) ? $entry['help'] : '',
				'help_url'    => isset( $entry['helpURL'] ) ? $entry['helpURL'] : '',
				'placeholder' => isset( $entry['placeholder'] ) ? $entry['placeholder'] : '',
				'provider'    => isset( $entry['provider'] ) ? $entry['provider'] : '',
				'sanitize'    => isset( $entry['sanitize_callback'] ) && is_callable( $entry['sanitize_callback'] )
					? $entry['sanitize_callback']
					: null,
			];
		}

		$schema['newspack_newsletters_use_tracking_pixel'] = [
			'key'         => 'newspack_newsletters_use_tracking_pixel',
			'label'       => __( 'Track the impressions of ads in your newsletter', 'newspack-newsletters' ),
			'type'        => 'checkbox',
			'default'     => true,
			'help'        => '',
			'help_url'    => '',
			'placeholder' => '',
			'provider'    => '',
			'sanitize'    => 'boolval',
		];
		$schema['newspack_newsletters_use_click_tracking'] = [
			'key'         => 'newspack_newsletters_use_click_tracking',
			'label'       => __( 'Track the clicks on ads in your newsletter', 'newspack-newsletters' ),
			'type'        => 'checkbox',
			'default'     => true,
			'help'        => '',
			'help_url'    => '',
			'placeholder' => '',
			'provider'    => '',
			'sanitize'    => 'boolval',
		];

		return $schema;
	}

	/**
	 * Map of credential-field → bool indicating which fields have a stored
	 * value. Credentials themselves never leave the server — the React
	 * shell uses these flags to render a "(set; leave blank to keep)"
	 * affordance and only POSTs new values when the user types them.
	 *
	 * @param string $slug        Provider slug.
	 * @param mixed  $credentials Raw `api_credentials()` payload.
	 * @return array
	 */
	private static function credentials_set_flags( $slug, $credentials ) {
		$allowlist = self::PROVIDER_CREDENTIAL_ALLOWLIST[ $slug ] ?? [];
		$flags     = [];
		foreach ( $allowlist as $field ) {
			$value         = is_array( $credentials ) && isset( $credentials[ $field ] ) ? $credentials[ $field ] : '';
			$flags[ $field ] = '' !== (string) $value;
		}
		return $flags;
	}

	/**
	 * Merge submitted credential fields with the provider's stored values
	 * so a partial update (only the field the user actually typed into)
	 * doesn't blank out the rest. Empty / missing fields fall back to the
	 * existing stored value.
	 *
	 * @param string $slug        Provider slug.
	 * @param array  $submitted   Credential fields posted by the client.
	 * @param object $provider    The active service-provider instance.
	 * @return array
	 */
	private static function merge_credentials( $slug, $submitted, $provider ) {
		$allowlist = self::PROVIDER_CREDENTIAL_ALLOWLIST[ $slug ] ?? [];
		if ( empty( $allowlist ) ) {
			return is_array( $submitted ) ? $submitted : [];
		}
		$existing = method_exists( $provider, 'api_credentials' ) ? $provider->api_credentials() : [];
		$existing = is_array( $existing ) ? $existing : [];
		$merged   = [];
		foreach ( $allowlist as $field ) {
			$incoming = is_array( $submitted ) && isset( $submitted[ $field ] ) ? (string) $submitted[ $field ] : '';
			if ( '' !== $incoming ) {
				$merged[ $field ] = $incoming;
				continue;
			}
			if ( isset( $existing[ $field ] ) ) {
				$merged[ $field ] = $existing[ $field ];
			}
		}
		return $merged;
	}

	/**
	 * Sanitise an option value against its schema entry.
	 *
	 * @param mixed $value Incoming value.
	 * @param array $field Schema entry.
	 * @return mixed
	 */
	private static function sanitize_option_value( $value, $field ) {
		if ( ! empty( $field['sanitize'] ) && is_callable( $field['sanitize'] ) ) {
			return call_user_func( $field['sanitize'], $value );
		}
		if ( 'checkbox' === $field['type'] ) {
			return (bool) $value;
		}
		return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';
	}
}

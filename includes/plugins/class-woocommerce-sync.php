<?php
/**
 * WP CLI scripts for managing WooCommerce Reader Revenue data syncing with
 * the connected ESP.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Plugins;

use Newspack_Subscription_Migrations\CSV_Importers\CSV_Importer;
use Newspack_Subscription_Migrations\Stripe_Sync;

defined( 'ABSPATH' ) || exit;

/**
 * WooCommerce Sync Class.
 */
class WooCommerce_Sync {
	// User roles that a customer can have.
	const CUSTOMER_ROLES = [ 'customer', 'subscriber' ];

	/**
	 * The final results object.
	 *
	 * @var array
	 * @codeCoverageIgnore
	 */
	protected static $results = [
		'processed' => 0,
	];

	/**
	 * Initialize.
	 *
	 * @codeCoverageIgnore
	 */
	public static function init() {
		\add_action( 'init', [ __CLASS__, 'wp_cli' ] );
	}

	/**
	 * Add CLI commands.
	 */
	public static function wp_cli() {
		if ( ! defined( 'WP_CLI' ) ) {
			return;
		}

		\WP_CLI::add_command(
			'newspack-newsletters woo resync',
			[ __CLASS__, 'cli_resync_woo_contacts' ],
			[
				'shortdesc' => __( 'Resync customer and transaction data to the connected ESP.', 'newspack-newsletters' ),
				'synopsis'  => [
					[
						'type'     => 'flag',
						'name'     => 'dry-run',
						'optional' => true,
					],
					[
						'type'     => 'flag',
						'name'     => 'active-only',
						'optional' => true,
					],
					[
						'type'     => 'assoc',
						'name'     => 'migrated-subscriptions',
						'default'  => false,
						'optional' => true,
						'options'  => [ 'stripe', 'piano-csv', 'stripe-csv', false ],
					],
					[
						'type'     => 'assoc',
						'name'     => 'subscription-ids',
						'default'  => false,
						'optional' => true,
					],
					[
						'type'     => 'assoc',
						'name'     => 'user-ids',
						'default'  => false,
						'optional' => true,
					],
					[
						'type'     => 'assoc',
						'name'     => 'order-ids',
						'default'  => false,
						'optional' => true,
					],
					[
						'type'     => 'assoc',
						'name'     => 'batch-size',
						'default'  => 10,
						'optional' => true,
					],
					[
						'type'     => 'assoc',
						'name'     => 'offset',
						'default'  => 0,
						'optional' => true,
					],
					[
						'type'     => 'assoc',
						'name'     => 'max-batches',
						'default'  => 0,
						'optional' => true,
					],
				],
			]
		);
	}

	/**
	 * CLI command for resyncing contact data from WooCommerce customers to the connected ESP.
	 *
	 * @param array $args Positional args.
	 * @param array $assoc_args Associative args.
	 */
	public static function cli_resync_woo_contacts( $args, $assoc_args ) {
		$config = [];
		$config['is_dry_run']       = ! empty( $assoc_args['dry-run'] );
		$config['active_only']      = ! empty( $assoc_args['active-only'] );
		$config['migrated_only']    = ! empty( $assoc_args['migrated-subscriptions'] ) ? $assoc_args['migrated-subscriptions'] : false;
		$config['subscription_ids'] = ! empty( $assoc_args['subscription-ids'] ) ? explode( ',', $assoc_args['subscription-ids'] ) : false;
		$config['user_ids']         = ! empty( $assoc_args['user-ids'] ) ? explode( ',', $assoc_args['user-ids'] ) : false;
		$config['order_ids']        = ! empty( $assoc_args['order-ids'] ) ? explode( ',', $assoc_args['order-ids'] ) : false;
		$config['batch_size']       = ! empty( $assoc_args['batch-size'] ) ? intval( $assoc_args['batch-size'] ) : 10;
		$config['offset']           = ! empty( $assoc_args['offset'] ) ? intval( $assoc_args['offset'] ) : 0;
		$config['max_batches']      = ! empty( $assoc_args['max-batches'] ) ? intval( $assoc_args['max-batches'] ) : 0;

		$processed = self::resync_woo_contacts( $config );

		if ( is_wp_error( $processed ) ) {
			\WP_CLI::error( $processed->get_error_message() );
			return;
		}

		\WP_CLI::line( "\n" );
		\WP_CLI::success(
			sprintf(
				// Translators: total number of resynced contacts.
				__(
					'Resynced %d contacts.',
					'newspack-newsletters'
				),
				$processed
			)
		);
	}

	/**
	 * Does the given user have any subscriptions with an active status?
	 *
	 * @param int $user_id User ID.
	 *
	 * @return bool
	 */
	protected static function user_has_active_subscriptions( $user_id ) {
		$subcriptions = array_reduce(
			array_keys( \wcs_get_users_subscriptions( $user_id ) ),
			function( $acc, $subscription_id ) {
				$subscription = \wcs_get_subscription( $subscription_id );
				if ( $subscription->has_status( [ 'active', 'pending', 'pending-cancel' ] ) ) {
					$acc[] = $subscription_id;
				}
				return $acc;
			},
			[]
		);

		return ! empty( $subcriptions );
	}

	/**
	 * Force disable RAS reader data syncing to ESP while running migrations on test/staging sites.
	 * Don't disable if connected to production manager, or data might be lost from actual reader activity.
	 *
	 * @param mixed $value The option value.
	 *
	 * @return mixed Filtered option value.
	 */
	protected static function maybe_disable_esp_syncing( $value ) {
		// If a production site, don't do anything.
		if ( method_exists( 'Newspack_Manager', 'is_connected_to_production_manager' ) && \Newspack_Manager::is_connected_to_production_manager() ) {
			return $value;
		}
		// If a staging/test site, disable ESP syncing unless we set a constant. The newspack_reader_activation_sync_esp option value will still be honored, if set.
		if ( defined( 'NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC' ) && NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC ) {
			return $value;
		}

		return false;
	}

	/**
	 * Sync contact to the ESP.
	 *
	 * @param array $contact The contact data to sync.
	 *
	 * @return void|\WP_Error WP_Error if an error occurred.
	 */
	protected static function sync_contact( $contact ) {
		// Only if Reader Activation is available.
		if ( ! class_exists( 'Newspack\Reader_Activation' ) ) {
			return;
		}

		// Only if RAS + ESP sync is enabled.
		if ( ! \Newspack\Reader_Activation::is_enabled() || ! \Newspack\Reader_Activation::get_setting( 'sync_esp' ) ) {
			return;
		}

		$master_list_id = \Newspack\Reader_Activation::get_esp_master_list_id();

		$result = \Newspack_Newsletters_Contacts::upsert( $contact, $master_list_id, 'WooCommerce Sync' );

		if ( \is_wp_error( $result ) ) {
			return $result;
		}
	}

	/**
	 * Log a message to the Newspack logger and/or WP CLI.
	 *
	 * @param string $message The message to log.
	 */
	protected static function log( $message ) {
		if ( class_exists( 'Newspack\Logger' ) ) {
			\Newspack\Logger::log( $message, 'NEWSPACK-NEWSLETTERS' );
		}
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\WP_CLI::log( $message );
		}
	}

	/**
	 * Get a batch of migrated subscriptions.
	 *
	 * This method requires the Newspack_Subscription_Migrations plugin to be
	 * installed and active, otherwise it will return a WP_Error.
	 *
	 * @param string $source The source of the subscriptions. One of 'stripe', 'piano-csv', 'stripe-csv'.
	 * @param int    $batch_size Number of subscriptions to get.
	 * @param int    $offset Number to skip.
	 * @param bool   $active_only Whether to get only active subscriptions.
	 *
	 * @return array|\WP_Error Array of subscription IDs, or WP_Error if an error occurred.
	 */
	protected static function get_migrated_subscriptions( $source, $batch_size, $offset, $active_only ) {
		if (
			! class_exists( '\Newspack_Subscription_Migrations\Stripe_Sync' ) ||
			! class_exists( '\Newspack_Subscription_Migrations\CSV_Importers\CSV_Importer' )
		) {
			return new \WP_Error(
				'newspack_newsletters_resync_woo_contacts',
				__( 'The migrated-subscriptions flag requires the Newspack_Subscription_Migrations plugin to be installed and active.', 'newspack-newsletters' )
			);
		}
		$subscription_ids = [];
		switch ( $source ) {
			case 'stripe':
				$subscription_ids = Stripe_Sync::get_migrated_subscriptions( $batch_size, $offset, $active_only );
				break;
			case 'piano-csv':
				$subscription_ids = CSV_Importer::get_migrated_subscriptions( 'piano', $batch_size, $offset, $active_only );
				break;
			case 'stripe-csv':
				$subscription_ids = CSV_Importer::get_migrated_subscriptions( 'stripe', $batch_size, $offset, $active_only );
				break;
			default:
				return new \WP_Error(
					'newspack_newsletters_resync_woo_contacts',
					sprintf(
						// Translators: %s is the source of the subscriptions.
						__( 'Invalid subscription migration type: %s', 'newspack-newsletters' ),
						$source
					)
				);
		}
		return $subscription_ids;
	}

	/**
	 * Resync contact data from WooCommerce customers to the connected ESP.
	 *
	 * @param array $config {
	 *   Configuration options.
	 *
	 *   @type bool        $config['is_dry_run'] True if a dry run.
	 *   @type bool        $config['active_only'] True if only active subscriptions should be synced.
	 *   @type string|bool $config['migrated_only'] If set, only sync subscriptions migrated from the given source.
	 *   @type array|bool  $config['subscription_ids'] If set, only sync the given subscription IDs.
	 *   @type array|bool  $config['user_ids'] If set, only sync the given user IDs.
	 *   @type array|bool  $config['order_ids'] If set, only sync the given order IDs.
	 *   @type int         $config['batch_size'] Number of contacts to sync per batch.
	 *   @type int         $config['offset'] Number of contacts to skip.
	 *   @type int         $config['max_batches'] Maximum number of batches to process.
	 *   @type bool        $config['is_dry_run'] True if a dry run.
	 * }
	 *
	 * @return int|\WP_Error Number of resynced contacts, or WP_Error if an error occurred.
	 */
	protected static function resync_woo_contacts( $config ) {
		$default_config = [
			'active_only'      => false,
			'migrated_only'    => false,
			'subscription_ids' => false,
			'user_ids'         => false,
			'order_ids'        => false,
			'batch_size'       => 10,
			'offset'           => 0,
			'max_batches'      => 0,
		];
		$config = \wp_parse_args( $config, $default_config );

		self::log( __( 'Running WooCommerce-to-ESP contact resync...', 'newspack-newsletters' ) );

		// If not doing a dry run, make sure the NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC
		// constant is set or the sync will fail silently.
		if ( ! $config['is_dry_run'] && ! self::maybe_disable_esp_syncing( true ) ) {
			return new \WP_Error(
				'newspack_newsletters_resync_woo_contacts',
				__( 'Unable to sync due to disabled ESP sync option. Is the NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC constant defined?', 'newspack-newsletters' )
			);
		}

		// If resyncing only migrated subscriptions.
		if ( $config['migrated_only'] ) {
			$config['subscription_ids'] = self::get_migrated_subscriptions( $config['migrated_only'], $config['batch_size'], $config['offset'], $config['active_only'] );
			if ( \is_wp_error( $config['subscription_ids'] ) ) {
				return $config['subscription_ids'];
			}
			$batches = 0;
		}

		if ( ! empty( $config['subscription_ids'] ) ) {
			self::log( __( 'Syncing by subscription ID...', 'newspack-newsletters' ) );

			while ( ! empty( $config['subscription_ids'] ) ) {
				$subscription_id = array_shift( $config['subscription_ids'] );
				$subscription    = \wcs_get_subscription( $subscription_id );

				if ( \is_wp_error( $subscription ) ) {
					self::log(
						sprintf(
							// Translators: %d is the subscription ID arg passed to the script.
							__( 'No subscription with ID %d. Skipping.', 'newspack-newsletters' ),
							$subscription_id
						)
					);

					continue;
				}

				self::resync_contact( 0, $subscription, $config['is_dry_run'] );

				// Get the next batch.
				if ( $config['migrated_only'] && empty( $config['subscription_ids'] ) ) {
					$batches++;

					if ( $config['max_batches'] && $batches >= $config['max_batches'] ) {
						break;
					}

					$next_batch_offset = $config['offset'] + ( $batches * $config['batch_size'] );
					$config['subscription_ids'] = self::get_migrated_subscriptions( $config['migrated_only'], $config['batch_size'], $next_batch_offset, $config['active_only'] );
				}
			}
		}

		// If order-ids flag is passed, resync contacts for those orders.
		if ( ! empty( $config['order_ids'] ) ) {
			self::log( __( 'Syncing by order ID...', 'newspack-newsletters' ) );
			foreach ( $config['order_ids'] as $order_id ) {
				$order = new \WC_Order( $order_id );

				if ( \is_wp_error( $order ) ) {
					self::log(
						sprintf(
							// Translators: %d is the order ID arg passed to the script.
							__( 'No order with ID %d. Skipping.', 'newspack-newsletters' ),
							$order_id
						)
					);

					continue;
				}

				self::resync_contact( 0, $order, $config['is_dry_run'] );
			}
		}

		// If user-ids flag is passed, resync those users.
		if ( ! empty( $config['user_ids'] ) ) {
			self::log( __( 'Syncing by customer user ID...', 'newspack-newsletters' ) );
			foreach ( $config['user_ids'] as $user_id ) {
				if ( ! $config['active_only'] || self::user_has_active_subscriptions( $user_id ) ) {
					self::resync_contact( $user_id, null, $config['is_dry_run'] );
				}
			}
		}

		// Default behavior: resync all customers and subscribers.
		if (
			false === $config['user_ids'] &&
			false === $config['order_ids'] &&
			false === $config['subscription_ids'] &&
			false === $config['migrated_only']
		) {
			self::log( __( 'Syncing all customers...', 'newspack-newsletters' ) );
			$user_ids = self::get_batch_of_customers( $config['batch_size'], $config['offset'] );
			$batches  = 0;

			while ( $user_ids ) {
				$user_id = array_shift( $user_ids );
				if ( ! $config['active_only'] || self::user_has_active_subscriptions( $user_id ) ) {
					self::resync_contact( $user_id, null, $config['is_dry_run'] );
				}

				// Get the next batch.
				if ( empty( $user_ids ) ) {
					$batches++;

					if ( $config['max_batches'] && $batches >= $config['max_batches'] ) {
						break;
					}

					$user_ids = self::get_batch_of_customers( $config['batch_size'], $config['offset'] + ( $batches * $config['batch_size'] ) );
				}
			}
		}

		return self::$results['processed'];
	}

	/**
	 * Given a WP user ID for a Woo customer, resync that customer's contact data in the connected ESP.
	 *
	 * @param int           $user_id WP user ID for the customer. If given, resync using the customer.
	 * @param WC_Order|null $order If given, resync using the order instead of the customer.
	 * @param bool          $is_dry_run True if a dry run.
	 *
	 * @return bool True if the contact was resynced successfully, false otherwise.
	 */
	protected static function resync_contact( $user_id = 0, $order = null, $is_dry_run = false ) {
		$result            = false;
		$registration_site = false;

		if ( ! $user_id && ! $order ) {
			self::log(
				sprintf(
				// Translators: %d is the user ID arg passed to the script.
					__( 'Must pass either a user ID or order. Skipping.', 'newspack-newsletters' ),
					$user_id
				)
			);

			return $result;
		}

		$user = \get_userdata( $user_id ? $user_id : $order->get_customer_id() );

		// Backfill Network Registration Site field if needed.
		if ( $user && defined( 'NEWSPACK_NETWORK_READER_ROLE' ) && defined( 'Newspack_Network\Utils\Users::USER_META_REMOTE_SITE' ) ) {
			if ( ! empty( array_intersect( $user->roles, \Newspack_Network\Utils\Users::get_synced_user_roles() ) ) ) {
				$registration_site = \esc_url( \get_site_url() ); // Default to current site.
				$remote_site       = \get_user_meta( $user->ID, \Newspack_Network\Utils\Users::USER_META_REMOTE_SITE, true );
				if ( ! empty( \wp_http_validate_url( $remote_site ) ) ) {
					$registration_site = \esc_url( $remote_site );
				}
			}
		}

		$customer = new \WC_Customer( $user_id ? $user_id : $order->get_customer_id() );
		if ( ! $customer || ! $customer->get_id() ) {
			self::log(
				sprintf(
				// Translators: %d is the user ID arg passed to the script.
					__( 'Customer with ID %d does not exist. Skipping.', 'newspack-newsletters' ),
					$user_id
				)
			);

			return $result;
		}

		// Ensure the customer has a billing address.
		if ( ! $customer->get_billing_email() && $customer->get_email() ) {
			$customer->set_billing_email( $customer->get_email() );
			$customer->save();
		}

		$contact = $user_id ? \Newspack\WooCommerce_Connection::get_contact_from_customer( $customer ) : \Newspack\WooCommerce_Connection::get_contact_from_order( $order );
		if ( $registration_site ) {
			$contact['metadata']['network_registration_site'] = $registration_site;
		}
		$result = $is_dry_run ? true : self::sync_contact( $contact );

		if ( $result && ! \is_wp_error( $result ) ) {
			self::log(
				sprintf(
					// Translators: %1$s is the resync status and %2$s is the contact's email address.
					__( '%1$s contact data for %2$s.', 'newspack-newsletters' ),
					$is_dry_run ? __( 'Would resync', 'newspack-newsletters' ) : __( 'Resynced', 'newspack-newsletters' ),
					$customer->get_email()
				)
			);
			self::$results['processed']++;
		}

		if ( \is_wp_error( $result ) ) {
			\WP_CLI::warning(
				sprintf(
					// Translators: $1$s is the contact's email address. %2$s is the error message.
					__( 'Error resyncing contact info for %1$s. %2$s' ),
					$customer->get_email(),
					$result->get_error_message()
				)
			);
		}

		return $result;
	}

	/**
	 * Get a batch of customer IDs.
	 *
	 * @param int $batch_size Number of customers to get.
	 * @param int $offset     Number to skip.
	 *
	 * @return array|false Array of customer IDs, or false if no more to fetch.
	 */
	protected static function get_batch_of_customers( $batch_size, $offset = 0 ) {
		$customer_roles = self::CUSTOMER_ROLES;
		if ( defined( 'NEWSPACK_NETWORK_READER_ROLE' ) ) {
			$customer_roles[] = NEWSPACK_NETWORK_READER_ROLE;
		}

		$query = new \WP_User_Query(
			[
				'fields'   => 'ID',
				'number'   => $batch_size,
				'offset'   => $offset,
				'order'    => 'DESC',
				'orderby'  => 'registered',
				'role__in' => $customer_roles,
			]
		);

		$results = $query->get_results();

		return ! empty( $results ) ? $results : false;
	}
}
WooCommerce_Sync::init();

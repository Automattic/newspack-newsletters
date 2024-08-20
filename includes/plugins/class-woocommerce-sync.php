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
	private static $results = [
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
			[ __CLASS__, 'resync_woo_contacts' ],
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
	 * Does the given user have any subscriptions with an active status?
	 *
	 * @param int $user_id User ID.
	 *
	 * @return bool
	 */
	public static function user_has_active_subscriptions( $user_id ) {
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
	private static function maybe_disable_esp_syncing( $value ) {
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
	 */
	public static function sync_contact( $contact ) {
		// Only if Reader Activation is available.
		if ( ! class_exists( 'Newspack\Reader_Activation' ) ) {
			return;
		}

		// Only if RAS + ESP sync is enabled.
		if ( ! \Newspack\Reader_Activation::is_enabled() || ! \Newspack\Reader_Activation::get_setting( 'sync_esp' ) ) {
			return;
		}

		// Only if we have the ESP Data Events connectors.
		if ( ! class_exists( 'Newspack\Data_Events\Connectors\Mailchimp' ) || ! class_exists( 'Newspack\Data_Events\Connectors\ActiveCampaign' ) ) {
			return;
		}

		\Newspack_Newsletters_Contacts::upsert( $contact, false, 'WooCommerce Sync' );
	}

	/**
	 * CLI command for resyncing contact data from WooCommerce customers to the connected ESP.
	 *
	 * @param array $args Positional args.
	 * @param array $assoc_args Associative args.
	 */
	public static function resync_woo_contacts( $args, $assoc_args ) {
		$is_dry_run       = ! empty( $assoc_args['dry-run'] );
		$active_only      = ! empty( $assoc_args['active-only'] );
		$migrated_only    = ! empty( $assoc_args['migrated-subscriptions'] ) ? $assoc_args['migrated-subscriptions'] : false;
		$subscription_ids = ! empty( $assoc_args['subscription-ids'] ) ? explode( ',', $assoc_args['subscription-ids'] ) : false;
		$user_ids         = ! empty( $assoc_args['user-ids'] ) ? explode( ',', $assoc_args['user-ids'] ) : false;
		$order_ids        = ! empty( $assoc_args['order-ids'] ) ? explode( ',', $assoc_args['order-ids'] ) : false;
		$batch_size       = ! empty( $assoc_args['batch-size'] ) ? intval( $assoc_args['batch-size'] ) : 10;
		$offset           = ! empty( $assoc_args['offset'] ) ? intval( $assoc_args['offset'] ) : 0;
		$max_batches      = ! empty( $assoc_args['max-batches'] ) ? intval( $assoc_args['max-batches'] ) : 0;

		\WP_CLI::log(
			'

Running WooCommerce-to-ESP contact resync...

		'
		);

		if ( $migrated_only && ! class_exists( '\Newspack_Subscription_Migrations\Stripe_Sync' ) ) {
			\WP_CLI::error( __( 'The migrated-subscriptions flag requires the Newspack_Subscription_Migrations plugin to installed and active.', 'newspack-newsletters' ) );
		}

		// If not doing a dry run, make sure the NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC
		// constant is set or the sync will fail silently.
		if ( ! $is_dry_run && ! self::maybe_disable_esp_syncing( true ) ) {
			\WP_CLI::error( __( 'Unable to sync due to disabled ESP sync option. Is the NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC constant defined?', 'newspack-newsletters' ) );
		}

		// If resyncing only migrated subscriptions.
		if ( $migrated_only ) {
			switch ( $migrated_only ) {
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
					\WP_CLI::error( __( 'Invalid subscription migration type ', 'newspack-newsletters' ) . $migrated_only );
			}
			$batches = 0;
		}

		if ( ! empty( $subscription_ids ) ) {
			\WP_CLI::log( __( 'Syncing by subscription ID...', 'newspack-newsletters' ) ) . "\n\n";

			while ( ! empty( $subscription_ids ) ) {
				$subscription_id = array_shift( $subscription_ids );
				$subscription    = \wcs_get_subscription( $subscription_id );

				if ( \is_wp_error( $subscription ) ) {
					\WP_CLI::log(
						sprintf(
							// Translators: %d is the subscription ID arg passed to the script.
							__( 'No subscription with ID %d. Skipping.', 'newspack-newsletters' ),
							$subscription_id
						)
					);

					continue;
				}

				self::resync_contact( 0, $subscription, $is_dry_run );

				// Get the next batch.
				if ( $migrated_only && empty( $subscription_ids ) ) {
					$batches++;

					if ( $max_batches && $batches >= $max_batches ) {
						break;
					}

					$next_batch = $offset + ( $batches * $batch_size );
					switch ( $migrated_only ) {
						case 'stripe':
							$subscription_ids = Stripe_Sync::get_migrated_subscriptions( $batch_size, $next_batch, $active_only );
							break;
						case 'piano-csv':
							$subscription_ids = CSV_Importer::get_migrated_subscriptions( 'piano', $batch_size, $next_batch, $active_only );
							break;
						case 'stripe-csv':
							$subscription_ids = CSV_Importer::get_migrated_subscriptions( 'stripe', $batch_size, $next_batch, $active_only );
							break;
						default:
							\WP_CLI::error( __( 'Invalid subscription migration type ', 'newspack-newsletters' ) . $migrated_only );
					}
				}
			}
		}

		// If order-ids flag is passed, resync contacts for those orders.
		if ( ! empty( $order_ids ) ) {
			\WP_CLI::log( __( 'Syncing by order ID...', 'newspack-newsletters' ) );
			foreach ( $order_ids as $order_id ) {
				$order = new \WC_Order( $order_id );

				if ( \is_wp_error( $order ) ) {
					\WP_CLI::log(
						sprintf(
							// Translators: %d is the order ID arg passed to the script.
							__( 'No order with ID %d. Skipping.', 'newspack-newsletters' ),
							$order_id
						)
					);

					continue;
				}

				self::resync_contact( 0, $order, $is_dry_run );
			}
		}

		// If user-ids flag is passed, resync those users.
		if ( ! empty( $user_ids ) ) {
			\WP_CLI::log( __( 'Syncing by customer user ID...', 'newspack-newsletters' ) );
			foreach ( $user_ids as $user_id ) {
				if ( ! $active_only || self::user_has_active_subscriptions( $user_id ) ) {
					self::resync_contact( $user_id, null, $is_dry_run );
				}
			}
		}

		// Default behavior: resync all customers and subscribers.
		if ( false === $user_ids && false === $order_ids && false === $subscription_ids && false === $migrated_only ) {
			\WP_CLI::log( __( 'Syncing all customers...', 'newspack-newsletters' ) );
			$user_ids = self::get_batch_of_customers( $batch_size, $offset );
			$batches  = 0;

			while ( $user_ids ) {
				$user_id = array_shift( $user_ids );
				if ( ! $active_only || self::user_has_active_subscriptions( $user_id ) ) {
					self::resync_contact( $user_id, null, $is_dry_run );
				}

				// Get the next batch.
				if ( empty( $user_ids ) ) {
					$batches++;

					if ( $max_batches && $batches >= $max_batches ) {
						break;
					}

					$user_ids = self::get_batch_of_customers( $batch_size, $offset + ( $batches * $batch_size ) );
				}
			}
		}

		\WP_CLI::line( "\n" );
		\WP_CLI::success(
			sprintf(
				// Translators: total number of resynced contacts.
				__(
					'Resynced %d contacts.',
					'newspack-newsletters'
				),
				self::$results['processed']
			)
		);
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
	public static function resync_contact( $user_id = 0, $order = null, $is_dry_run = false ) {
		$result            = false;
		$registration_site = false;

		if ( ! $user_id && ! $order ) {
			\WP_CLI::log(
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
			\WP_CLI::log(
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
			\WP_CLI::log(
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
	public static function get_batch_of_customers( $batch_size, $offset = 0 ) {
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

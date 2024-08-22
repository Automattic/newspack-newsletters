<?php
/**
 * CLI tools for the WooCommerce Sync.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Plugins;

defined( 'ABSPATH' ) || exit;

/**
 * WooCommerce Sync CLI Class.
 */
class WooCommerce_Sync_CLI extends WooCommerce_Sync {

	/**
	 * The final results object.
	 *
	 * @var array
	 */
	protected static $results = [
		'processed' => 0,
	];

	/**
	 * Initialize hooks.
	 */
	public static function init_hooks() {
		\add_action( 'init', [ __CLASS__, 'wp_cli' ] );
	}

	/**
	 * Log to WP CLI.
	 *
	 * @param string $message The message to log.
	 */
	protected static function log( $message ) {
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\WP_CLI::log( $message );
		}
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
			'is_dry_run'       => false,
		];
		$config = \wp_parse_args( $config, $default_config );

		static::log( __( 'Running WooCommerce-to-ESP contact resync...', 'newspack-newsletters' ) );

		$can_sync = static::can_sync_contacts( true );
		if ( ! $config['is_dry_run'] && $can_sync->has_errors() ) {
			return $can_sync;
		}

		// If resyncing only migrated subscriptions.
		if ( $config['migrated_only'] ) {
			$config['subscription_ids'] = static::get_migrated_subscriptions( $config['migrated_only'], $config['batch_size'], $config['offset'], $config['active_only'] );
			if ( \is_wp_error( $config['subscription_ids'] ) ) {
				return $config['subscription_ids'];
			}
			$batches = 0;
		}

		if ( ! empty( $config['subscription_ids'] ) ) {
			static::log( __( 'Syncing by subscription ID...', 'newspack-newsletters' ) );

			while ( ! empty( $config['subscription_ids'] ) ) {
				$subscription_id = array_shift( $config['subscription_ids'] );
				$subscription    = \wcs_get_subscription( $subscription_id );

				if ( \is_wp_error( $subscription ) ) {
					static::log(
						sprintf(
							// Translators: %d is the subscription ID arg passed to the script.
							__( 'No subscription with ID %d. Skipping.', 'newspack-newsletters' ),
							$subscription_id
						)
					);

					continue;
				}

				$result = static::resync_contact( 0, $subscription, $config['is_dry_run'] );
				if ( \is_wp_error( $result ) ) {
					static::log(
						sprintf(
							// Translators: %1$d is the subscription ID arg passed to the script. %2$s is the error message.
							__( 'Error resyncing contact info for subscription ID %1$d. %2$s', 'newspack-newsletters' ),
							$subscription_id,
							$result->get_error_message()
						)
					);
				}

				// Get the next batch.
				if ( $config['migrated_only'] && empty( $config['subscription_ids'] ) ) {
					$batches++;

					if ( $config['max_batches'] && $batches >= $config['max_batches'] ) {
						break;
					}

					$next_batch_offset = $config['offset'] + ( $batches * $config['batch_size'] );
					$config['subscription_ids'] = static::get_migrated_subscriptions( $config['migrated_only'], $config['batch_size'], $next_batch_offset, $config['active_only'] );
				}
			}
		}

		// If order-ids flag is passed, resync contacts for those orders.
		if ( ! empty( $config['order_ids'] ) ) {
			static::log( __( 'Syncing by order ID...', 'newspack-newsletters' ) );
			foreach ( $config['order_ids'] as $order_id ) {
				$order = new \WC_Order( $order_id );

				if ( \is_wp_error( $order ) ) {
					static::log(
						sprintf(
							// Translators: %d is the order ID arg passed to the script.
							__( 'No order with ID %d. Skipping.', 'newspack-newsletters' ),
							$order_id
						)
					);

					continue;
				}

				$result = static::resync_contact( 0, $order, $config['is_dry_run'] );
				if ( \is_wp_error( $result ) ) {
					static::log(
						sprintf(
							// Translators: %1$d is the order ID arg passed to the script. %2$s is the error message.
							__( 'Error resyncing contact info for order ID %1$d. %2$s', 'newspack-newsletters' ),
							$order_id,
							$result->get_error_message()
						)
					);
				}
			}
		}

		// If user-ids flag is passed, resync those users.
		if ( ! empty( $config['user_ids'] ) ) {
			static::log( __( 'Syncing by customer user ID...', 'newspack-newsletters' ) );
			foreach ( $config['user_ids'] as $user_id ) {
				if ( ! $config['active_only'] || static::user_has_active_subscriptions( $user_id ) ) {
					$result = static::resync_contact( $user_id, null, $config['is_dry_run'] );
					if ( \is_wp_error( $result ) ) {
						static::log(
							sprintf(
								// Translators: %1$d is the user ID arg passed to the script. %2$s is the error message.
								__( 'Error resyncing contact info for user ID %1$d. %2$s', 'newspack-newsletters' ),
								$user_id,
								$result->get_error_message()
							)
						);
					}
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
			static::log( __( 'Syncing all customers...', 'newspack-newsletters' ) );
			$user_ids = static::get_batch_of_customers( $config['batch_size'], $config['offset'] );
			$batches  = 0;

			while ( $user_ids ) {
				$user_id = array_shift( $user_ids );
				if ( ! $config['active_only'] || static::user_has_active_subscriptions( $user_id ) ) {
					$result = static::resync_contact( $user_id, null, $config['is_dry_run'] );
					if ( \is_wp_error( $result ) ) {
						static::log(
							sprintf(
								// Translators: $1$s is the contact's email address. %2$s is the error message.
								__( 'Error resyncing contact info for %1$s. %2$s' ),
								$customer->get_email(),
								$result->get_error_message()
							)
						);
					}
				}

				// Get the next batch.
				if ( empty( $user_ids ) ) {
					$batches++;

					if ( $config['max_batches'] && $batches >= $config['max_batches'] ) {
						break;
					}

					$user_ids = static::get_batch_of_customers( $config['batch_size'], $config['offset'] + ( $batches * $config['batch_size'] ) );
				}
			}
		}

		return static::$results['processed'];
	}

	/**
	 * Get a batch of reader IDs.
	 *
	 * @param int $batch_size Number of readers to get.
	 * @param int $offset     Number to skip.
	 *
	 * @return array|false Array of customer IDs, or false if no more to fetch.
	 */
	protected static function get_batch_of_readers( $batch_size, $offset = 0 ) {
		$roles = \Newspack\Reader_Activation::get_reader_roles();
		if ( defined( 'NEWSPACK_NETWORK_READER_ROLE' ) && ! in_array( NEWSPACK_NETWORK_READER_ROLE, $roles, true ) ) {
			$roles[] = NEWSPACK_NETWORK_READER_ROLE;
		}

		$query = new \WP_User_Query(
			[
				'fields'   => 'ID',
				'number'   => $batch_size,
				'offset'   => $offset,
				'order'    => 'DESC',
				'orderby'  => 'registered',
				'role__in' => $roles,
			]
		);

		$results = $query->get_results();

		return ! empty( $results ) ? $results : false;
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

		$processed = static::resync_woo_contacts( $config );

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
}
WooCommerce_Sync_CLI::init_hooks();
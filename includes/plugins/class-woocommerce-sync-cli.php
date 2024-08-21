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

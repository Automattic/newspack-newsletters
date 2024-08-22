<?php
/**
 * WooCommerce Reader Revenue data syncing with the connected ESP.
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
abstract class WooCommerce_Sync {
	/**
	 * Log a message to the Newspack logger and/or WP CLI.
	 *
	 * @param string $message The message to log.
	 */
	protected static function log( $message ) {
		if ( class_exists( 'Newspack\Logger' ) ) {
			\Newspack\Logger::log( $message, 'NEWSPACK-NEWSLETTERS' );
		}
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
	 * Whether contacts can be synced to the ESP.
	 *
	 * @param bool $return_errors Optional. Whether to return a WP_Error object. Default false.
	 *
	 * @return bool|WP_Error True if contacts can be synced, false otherwise. WP_Error if return_errors is true.
	 */
	protected static function can_sync_contacts( $return_errors = false ) {
		$errors = new \WP_Error();
		if ( ! class_exists( 'Newspack\Reader_Activation' ) ) {
			$errors->add(
				'ras_not_available',
				__( 'Reader Activation is not available.', 'newspack-newsletters' )
			);
		}

		if ( ! \Newspack\Reader_Activation::is_enabled() ) {
			$errors->add(
				'ras_not_enabled',
				__( 'Reader Activation is not enabled.', 'newspack-newsletters' )
			);
		}

		if ( ! \Newspack\Reader_Activation::get_setting( 'sync_esp' ) ) {
			$errors->add(
				'ras_esp_sync_not_enabled',
				__( 'ESP sync is not enabled.', 'newspack-newsletters' )
			);
		}

		// If not a production site, only sync if the NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC constant is set.
		if (
			( ! method_exists( 'Newspack_Manager', 'is_connected_to_production_manager' ) || ! \Newspack_Manager::is_connected_to_production_manager() ) &&
			( ! defined( 'NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC' ) || ! NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC )
		) {
			$errors->add(
				'esp_sync_not_allowed',
				__( 'ESP sync is disabled for non-production sites. Set NEWSPACK_SUBSCRIPTION_MIGRATIONS_ALLOW_ESP_SYNC to allow sync.', 'newspack-newsletters' )
			);
		}

		if ( $return_errors ) {
			return $errors;
		}

		if ( $errors->has_errors() ) {
			return false;
		}

		return true;
	}

	/**
	 * Sync contact to the ESP.
	 *
	 * @param array $contact The contact data to sync.
	 *
	 * @return true|\WP_Error True if succeeded or WP_Error.
	 */
	protected static function sync_contact( $contact ) {
		$can_sync = static::can_sync_contacts( true );
		if ( $can_sync->has_errors() ) {
			return $can_sync;
		}

		$master_list_id = \Newspack\Reader_Activation::get_esp_master_list_id();

		$result = \Newspack_Newsletters_Contacts::upsert( $contact, $master_list_id, 'WooCommerce Sync' );

		if ( \is_wp_error( $result ) ) {
			return $result;
		}
		return true;
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
	 * @return array|\WP_Error Array of subscription IDs or WP_Error.
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
	 * Given a WP user ID for a Woo customer or order ID, resync that customer's
	 * contact data in the connected ESP.
	 *
	 * @param int           $user_id WP user ID for the customer. If given, resync using the customer.
	 * @param WC_Order|null $order If given, resync using the order instead of the customer.
	 * @param bool          $is_dry_run True if a dry run.
	 *
	 * @return bool True if the contact was resynced successfully, false otherwise.
	 */
	protected static function resync_contact( $user_id = 0, $order = null, $is_dry_run = false ) {
		$can_sync = static::can_sync_contacts( true );
		if ( ! $is_dry_run && $can_sync->has_errors() ) {
			return $can_sync;
		}

		$result            = false;
		$registration_site = false;

		if ( ! $user_id && ! $order ) {
			return new \WP_Error( 'newspack_newsletters_resync_contact', __( 'Must pass either a user ID or order.', 'newspack-newsletters' ) );
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
			return new \WP_Error(
				'newspack_newsletters_resync_contact',
				sprintf(
				// Translators: %d is the user ID arg passed to the script.
					__( 'Customer with ID %d does not exist.', 'newspack-newsletters' ),
					$user_id
				)
			);
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
		$result = $is_dry_run ? true : static::sync_contact( $contact );

		if ( $result && ! \is_wp_error( $result ) ) {
			static::log(
				sprintf(
					// Translators: %1$s is the resync status and %2$s is the contact's email address.
					__( '%1$s contact data for %2$s.', 'newspack-newsletters' ),
					$is_dry_run ? __( 'Would resync', 'newspack-newsletters' ) : __( 'Resynced', 'newspack-newsletters' ),
					$customer->get_email()
				)
			);
			if ( ! empty( static::$results ) ) {
				static::$results['processed']++;
			}
		}

		return $result;
	}
}

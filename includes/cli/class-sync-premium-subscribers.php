<?php
/**
 * Newspack Newsletters Premium Subscribers CLI.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\CLI;

defined( 'ABSPATH' ) || exit;

/**
 * Manages Settings page.
 */
class Sync_Premium_Subscribers {
	/**
	 * Initialize the class
	 *
	 * @codeCoverageIgnore
	 */
	public static function init() {
		add_action( 'init', [ __CLASS__, 'initialize_cli_commands' ] );
	}

	/**
	 * Initialize CLI commands.
	 *
	 * @codeCoverageIgnore
	 */
	public static function initialize_cli_commands() {
		if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
			return;
		}

		\WP_CLI::add_command(
			'newspack-newsletters sync-premium-subscribers',
			[ __CLASS__, 'cli_sync_premium_subscribers' ],
			[
				'shortdesc' => 'Synchronizes the premium newsletter lists with the memberships.',
				'synopsis'  => [],
			]
		);
	}

	/**
	 * Can a memberships be considered active?
	 *
	 * @param \WC_Memberships_User_Membership $user_membership User membership.
	 */
	public static function is_membership_active( $user_membership ): bool {
		$active_statuses = wc_memberships()->get_user_memberships_instance()->get_active_access_membership_statuses();
		return in_array( $user_membership->get_status(), $active_statuses );
	}

	/**
	 * CLI handler for premium newsletter lists synchronization.
	 *
	 * @param array $args Indexed array of args.
	 * @param array $assoc_args Associative array of args.
	 * @return void
	 *
	 * ## OPTIONS
	 *
	 * [--live]
	 * : Run the command in live mode, updating the data.
	 *
	 * [--verbose]
	 * : More output.
	 *
	 * ## EXAMPLES
	 *
	 *     wp newspack-newsletters sync-premium-subscribers
	 */
	public static function cli_sync_premium_subscribers( $args, $assoc_args ) {
		\WP_CLI::log( '' );

		if ( ! function_exists( 'wc_memberships_get_membership_plans' ) ) {
			\WP_CLI::error( 'The woocommerce-memberships plugin must be active.' );
		}

		$live         = isset( $assoc_args['live'] ) ? true : false;
		$verbose      = isset( $assoc_args['verbose'] ) ? true : false;
		if ( $live ) {
			\WP_CLI::log( 'Live mode.' );
		} else {
			\WP_CLI::log( 'Dry run. Use --live flag to run in live mode.' );
		}
		\WP_CLI::log( '' );

		$provider = \Newspack_Newsletters::get_service_provider();
		if ( ! $provider ) {
			\WP_CLI::error( 'No ESP provider set.' );
		}

		foreach ( wc_memberships_get_membership_plans() as $plan ) {
			foreach ( $plan->get_content_restriction_rules() as $rule ) {
				if ( \Newspack\Newsletters\Subscription_Lists::CPT === $rule->get_content_type_name() ) {
					if ( $verbose ) {
						\WP_CLI::log( sprintf( 'Processing WCM plan "%s"', $plan->get_name() ) );
					}

					$restricted_lists = [];
					foreach ( $rule->get_object_ids() as $list_id ) {
						try {
							$list = new \Newspack\Newsletters\Subscription_List( $list_id );
							$restricted_lists[] = $list;
						} catch ( \Throwable $th ) {
							\WP_CLI::warning( sprintf( 'Could not get subscription list for ID %d: %s', $list_id, $th->getMessage() ) );
							continue;
						}
					}

					if ( empty( $restricted_lists ) ) {
						\WP_CLI::warning( 'No subscription lists to process for the plan, skipping.' );
						continue;
					}

					$plan_memberships = $plan->get_memberships();
					foreach ( $restricted_lists as $list ) {
						$list_remote_id = $list->get_remote_id();
						\WP_CLI::log( sprintf( '  - Synchronizing list "%s" (#%d, remote ID: %s)', $list->get_title(), $list->get_id(), $list_remote_id ) );
						foreach ( $plan_memberships as $user_membership ) {
							$user = $user_membership->get_user();
							if ( ! $user ) {
								continue;
							}
							$email = $user->user_email;
							if ( ! $email ) {
								\WP_CLI::warning( sprintf( 'No email for user #%d, skipping.', $user->ID ) );
								continue;
							}
							$membership_id = $user_membership->get_id();
							$membership_status = $user_membership->get_status();
							if ( $verbose ) {
								\WP_CLI::log( sprintf( '    - Processing user %s with membership #%d of status %s.', $email, $membership_id, $membership_status ) );
							}

							$result = null;
							$lists_to_add = [];
							$lists_to_remove = [];
							if ( self::is_membership_active( $user_membership ) ) {
								$lists_to_add = [ $list_remote_id ];
							} else {
								$lists_to_remove = [ $list_remote_id ];
							}

							if ( $verbose ) {
								\WP_CLI::log(
									$live ? '      - Updating the contact in the ESP…' : '      - Would update the contact in the ESP.'
								);
							}

							if ( $live ) {
								$result = \Newspack_Newsletters_Contacts::add_and_remove_lists(
									$email,
									$lists_to_add,
									$lists_to_remove,
									'Updating contact when running the sync-premium-subscribers CLI sync script.'
								);
							}

							if ( \is_wp_error( $result ) ) {
								\WP_CLI::warning( sprintf( 'Error when updating lists: %s', $result->get_error_message() ) );
							} elseif ( $result !== null ) {
								\WP_CLI::success( sprintf( 'User %s processed successfully!', $email ) );
							}
						}
					}
				}
			}
		}

		\WP_CLI::log( '' );
	}
}
Sync_Premium_Subscribers::init();

<?php
/**
 * Admin panel tools for the WooCommerce Sync.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Plugins;

defined( 'ABSPATH' ) || exit;

/**
 * WooCommerce Sync Admin Class.
 */
class WooCommerce_Sync_Admin extends WooCommerce_Sync {

	const ADMIN_ACTION = 'newspack-newsletters-wc-resync';

	/**
	 * Initializes hooks.
	 */
	public static function init_hooks() {
		add_action( 'admin_init', [ __CLASS__, 'process_admin_action' ] );
		add_filter( 'user_row_actions', [ __CLASS__, 'user_row_actions' ], 100, 2 );
		add_filter( 'bulk_actions-users', [ __CLASS__, 'bulk_actions' ] );
		add_filter( 'handle_bulk_actions-users', [ __CLASS__, 'handle_bulk_actions' ], 10, 3 );
		add_action( 'admin_notices', [ __CLASS__, 'admin_notices' ] );
	}

	/**
	 * Get url for the admin action.
	 *
	 * @param int $user_id User to get the URL for.
	 *
	 * @return string Admin URL to perform the admin action.
	 */
	private static function get_admin_action_url( $user_id ) {
		if ( ! \is_admin() ) {
			return '';
		}
		return \add_query_arg(
			[
				'action'   => self::ADMIN_ACTION,
				'uid'      => $user_id,
				'_wpnonce' => \wp_create_nonce( self::ADMIN_ACTION ),
			]
		);
	}

	/**
	 * Adds resync action to user row actions.
	 *
	 * @param string[] $actions User row actions.
	 * @param \WP_User $user    User object.
	 *
	 * @return string[] User row actions.
	 */
	public static function user_row_actions( $actions, $user ) {
		if ( \current_user_can( 'edit_user', $user->ID ) ) {
			$url = self::get_admin_action_url( $user->ID );
			$actions[ self::ADMIN_ACTION ] = '<a href="' . $url . '">' . \esc_html__( 'Resync contact to ESP', 'newspack-newsletters' ) . '</a>';
		}
		return $actions;
	}

	/**
	 * Bulk actions for users.
	 *
	 * @param string[] $actions Bulk actions.
	 *
	 * @return string[] Bulk actions.
	 */
	public static function bulk_actions( $actions ) {
		if ( ! current_user_can( 'edit_users' ) ) {
			return $actions;
		}
		$actions[ self::ADMIN_ACTION ] = \esc_html__( 'Resync to the ESP', 'newspack-newsletters' );
		return $actions;
	}

	/**
	 * Handle bulk actions.
	 *
	 * @param string $sendback The redirect URL.
	 * @param string $doaction The action being taken.
	 * @param array  $items    User IDs.
	 *
	 * @return string The redirect URL.
	 */
	public static function handle_bulk_actions( $sendback, $doaction, $items ) {
		if ( 'newspack-newsletters-wc-resync' === $doaction ) {
			if ( ! \current_user_can( 'edit_users' ) ) {
				\wp_die( \esc_html__( 'You do not have permission to do that.', 'newspack-newsletters' ) );
			}
			$config = [
				'user_ids' => $items,
			];
			$result = self::resync_woo_contacts( $config );
			if ( \is_wp_error( $result ) ) {
				\wp_die( $result ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			}
			$sendback = \add_query_arg(
				[
					'update'          => self::ADMIN_ACTION,
					'synced-contacts' => count( $items ),
				],
				$sendback
			);
		}
		return $sendback;
	}

	/**
	 * Process admin action request.
	 */
	public static function process_admin_action() {

		if ( ! isset( $_GET['action'] ) || self::ADMIN_ACTION !== $_GET['action'] ) {
			return;
		}

		$action = \sanitize_text_field( \wp_unslash( $_GET['action'] ) );

		// If we don't have UID, it's probably a bulk action.
		if ( ! isset( $_GET['uid'] ) ) {
			return;
		}

		if ( ! \check_admin_referer( $action ) ) {
			\wp_die( \esc_html__( 'Invalid request.', 'newspack-newsletters' ) );
		}

		$user_id = \absint( \wp_unslash( $_GET['uid'] ) );

		if ( ! \current_user_can( 'edit_user', $user_id ) ) {
			\wp_die( \esc_html__( 'You do not have permission to do that.', 'newspack-newsletters' ) );
		}

		$user = \get_user_by( 'id', $user_id );

		if ( ! $user || \is_wp_error( $user ) ) {
			\wp_die( \esc_html__( 'User not found.', 'newspack-newsletters' ) );
		}

		$config = [
			'user_ids' => [ $user_id ],
		];
		$result = self::resync_woo_contacts( $config );
		if ( \is_wp_error( $result ) ) {
			\wp_die( $result ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		}

		$redirect = \add_query_arg( [ 'update' => $action ], \remove_query_arg( [ 'action', 'uid', '_wpnonce' ] ) );
		\wp_safe_redirect( $redirect );
		exit;
	}

	/**
	 * Admin notices.
	 */
	public static function admin_notices() {
		// phpcs:disable WordPress.Security.NonceVerification
		if ( ! isset( $_GET['update'] ) ) {
			return;
		}
		$update = sanitize_text_field( wp_unslash( $_GET['update'] ) );
		if ( self::ADMIN_ACTION !== $update ) {
			return;
		}
		$message = __( 'Contact resynced to the ESP.', 'newspack-newsletters' );
		if ( isset( $_GET['synced-contacts'] ) && 1 < $_GET['synced-contacts'] ) {
			$synced_contacts = absint( wp_unslash( $_GET['synced-contacts'] ) );
			$message = sprintf(
				// translators: %d: number of contacts resynced.
				__( '%d contacts resynced to the ESP.', 'newspack-newsletters' ),
				$synced_contacts
			);
		}
		?>
		<div class="notice notice-success is-dismissible">
			<p><?php echo esc_html( $message ); ?></p>
		</div>
		<?php
		// phpcs:enable
	}
}
WooCommerce_Sync_Admin::init_hooks();

<?php
/**
 * Newspack Newsletters Wizard Bridge.
 *
 * Enqueues the bridge JS bundle on the bundled-mode (newspack-plugin)
 * Newsletters Settings wizard, so its `<SubscriptionLists>` card can dispatch
 * document events that mount this plugin's `<LocalListModal>` /
 * `<LocalListDeleteModal>` flows.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters;

defined( 'ABSPATH' ) || exit;

/**
 * Wizard Bridge.
 */
class Wizard_Bridge {

	const SCRIPT_HANDLE    = 'newspack-newsletters-wizard-bridge';
	const WIZARD_PAGE_SLUG = 'newspack-newsletters';

	/**
	 * Hook registration entry point.
	 */
	public static function init() {
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'maybe_enqueue' ] );
	}

	/**
	 * Decide whether to enqueue on the current admin screen.
	 *
	 * @return bool
	 */
	public static function should_enqueue() {
		if ( ! is_admin() ) {
			return false;
		}
		if ( ! class_exists( '\Newspack\Newspack' ) ) {
			return false;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
		return self::WIZARD_PAGE_SLUG === $page;
	}

	/**
	 * Enqueue the bridge bundle when applicable.
	 */
	public static function maybe_enqueue() {
		if ( ! self::should_enqueue() ) {
			return;
		}

		$asset_path = NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/wizard-bridge.asset.php';
		if ( ! file_exists( $asset_path ) ) {
			return;
		}
		$asset = require $asset_path;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			plugins_url( '../dist/wizard-bridge.js', __FILE__ ),
			$asset['dependencies'],
			$asset['version'],
			true
		);

		if ( file_exists( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/wizard-bridge.css' ) ) {
			wp_enqueue_style(
				self::SCRIPT_HANDLE,
				plugins_url( '../dist/wizard-bridge.css', __FILE__ ),
				[],
				$asset['version']
			);
		}

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'newspack_newsletters_wizard_bridge',
			[
				'debug' => defined( 'WP_DEBUG' ) && WP_DEBUG,
			]
		);
	}
}

<?php
/**
 * Admin shell bootstrap.
 *
 * Provides the React mount infrastructure (asset enqueue, page registry,
 * mode detection) that surfaces in NEWS-1928 to NEWS-1931 plug into.
 *
 * The chassis itself does not introduce its own top-level menu — pages
 * register as submenus under the Newsletters CPT menu (or, in NEWS-1929's
 * case, as a separate top-level menu) so the existing menu structure is
 * preserved.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

use Newspack_Newsletters;

/**
 * Registers the React-based Newsletters admin shell.
 */
class Admin_Shell {
	const SCRIPT_HANDLE = 'newspack-newsletters-admin-shell';

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', [ __CLASS__, 'register_menu' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );
	}

	/**
	 * Register React-shell submenu pages under the Newsletters CPT menu.
	 */
	public static function register_menu() {
		foreach ( self::get_pages() as $page ) {
			add_submenu_page(
				'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				$page->get_label(),
				$page->get_label(),
				$page->get_capability(),
				$page->get_slug(),
				[ $page, 'render' ]
			);
		}
	}

	/**
	 * Enqueue the shared admin-shell bundle on registered admin pages.
	 *
	 * @param string $hook_suffix Current admin page hook suffix.
	 */
	public static function enqueue_assets( $hook_suffix ) {
		$current_page = self::get_current_page();
		if ( ! $current_page ) {
			return;
		}
		unset( $hook_suffix );

		$asset_path = NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/admin-shell.asset.php';
		if ( ! file_exists( $asset_path ) ) {
			return;
		}
		$asset = require $asset_path;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			plugins_url( '../../dist/admin-shell.js', __FILE__ ),
			$asset['dependencies'],
			$asset['version'],
			true
		);

		if ( file_exists( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/admin-shell.css' ) ) {
			wp_enqueue_style(
				self::SCRIPT_HANDLE,
				plugins_url( '../../dist/admin-shell.css', __FILE__ ),
				[],
				$asset['version']
			);
		}

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'newspackNewslettersAdmin',
			[
				'currentPage'     => $current_page->get_slug(),
				'mountId'         => $current_page->get_mount_id(),
				'label'           => $current_page->get_label(),
				'bundledMode'     => self::is_bundled_mode(),
				'classicSettings' => admin_url( 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '&page=newspack-newsletters-settings-admin' ),
				'restNonce'       => wp_create_nonce( 'wp_rest' ),
				'restUrl'         => esc_url_raw( rest_url() ),
			]
		);
	}

	/**
	 * Resolve the Admin_Page matching the current admin request, if any.
	 *
	 * @return Admin_Page|null
	 */
	public static function get_current_page() {
		foreach ( self::get_pages() as $page ) {
			if ( $page->is_admin_page() ) {
				return $page;
			}
		}
		return null;
	}

	/**
	 * Whether the plugin is running alongside newspack-plugin.
	 *
	 * @return bool
	 */
	public static function is_bundled_mode() {
		/**
		 * Filters whether the admin shell should run in bundled mode.
		 *
		 * Bundled mode means newspack-plugin is the canonical surface for
		 * shared settings (Engagement > Newsletters); standalone mode means
		 * this plugin owns its own settings page.
		 *
		 * @param bool $is_bundled Default detection: whether the Newspack core class is loaded.
		 */
		return (bool) apply_filters( 'newspack_newsletters_admin_bundled_mode', class_exists( '\Newspack\Newspack' ) );
	}

	/**
	 * Get the registered admin pages, filtered by mode.
	 *
	 * In bundled mode the Settings page is omitted because the canonical
	 * settings surface is newspack-plugin's Engagement > Newsletters page.
	 *
	 * @return Admin_Page[]
	 */
	public static function get_pages() {
		if ( self::is_bundled_mode() ) {
			return [];
		}
		return [
			new Pages\Settings_Page(),
		];
	}
}

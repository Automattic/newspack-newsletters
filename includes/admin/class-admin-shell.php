<?php
/**
 * Admin shell bootstrap.
 *
 * Owns the top-level "Newsletters" admin menu and the React-based
 * submenu pages mounted within it.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the React-based Newsletters admin shell.
 */
class Admin_Shell {
	const SCRIPT_HANDLE = 'newspack-newsletters-admin-shell';
	const MENU_SLUG     = 'newspack-newsletters';
	const MENU_POSITION = 26;

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', [ __CLASS__, 'register_menu' ] );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );
	}

	/**
	 * Register the top-level menu and React-shell submenu pages.
	 */
	public static function register_menu() {
		$pages = self::get_pages();
		if ( empty( $pages ) ) {
			return;
		}

		$first    = $pages[0];
		$icon_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 7c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm2-.5h14c.3 0 .5.2.5.5v1L12 13.5 4.5 7.9V7c0-.3.2-.5.5-.5Zm-.5 3.3V17c0 .3.2.5.5.5h14c.3 0 .5-.2.5-.5V9.8L12 15.4 4.5 9.8Z"></path></svg>';

		add_menu_page(
			$first->get_label(),
			__( 'Newsletters', 'newspack-newsletters' ),
			$first->get_capability(),
			self::MENU_SLUG,
			[ $first, 'render' ],
			'data:image/svg+xml;base64,' . base64_encode( $icon_svg ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
			self::MENU_POSITION
		);

		foreach ( $pages as $page ) {
			add_submenu_page(
				self::MENU_SLUG,
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
				'currentPage' => $current_page->get_slug(),
				'mountId'     => $current_page->get_mount_id(),
				'label'       => $current_page->get_label(),
				'bundledMode' => self::is_bundled_mode(),
				'restNonce'   => wp_create_nonce( 'wp_rest' ),
				'restUrl'     => esc_url_raw( rest_url() ),
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
		$pages = [
			new Pages\Newsletters_Page(),
			new Pages\Layouts_Page(),
			new Pages\Ads_Page(),
		];
		if ( ! self::is_bundled_mode() ) {
			$pages[] = new Pages\Settings_Page();
		}
		return $pages;
	}
}

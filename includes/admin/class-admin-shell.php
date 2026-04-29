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
		// Run after the CPT auto-generates its submenu (priority 0) so we can
		// surgically replace the "All Newsletters" entry.
		add_action( 'admin_menu', [ __CLASS__, 'register_menu' ], 11 );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );
		add_action( 'current_screen', [ __CLASS__, 'maybe_redirect_legacy_list' ] );
	}

	/**
	 * Register React-shell submenu pages under the Newsletters CPT menu and
	 * suppress the WP-generated "All Newsletters" submenu.
	 */
	public static function register_menu() {
		self::replace_default_newsletters_submenu();

		// Position 0 lands the React list page at the top of the CPT submenu —
		// this also drives WP's "top-level menu link follows first submenu" so
		// clicking the Newsletters parent goes to the list, not Add New.
		$position = 0;

		foreach ( self::get_pages() as $page ) {
			add_submenu_page(
				'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				$page->get_label(),
				$page->get_label(),
				$page->get_capability(),
				$page->get_slug(),
				[ $page, 'render' ],
				$position
			);
			$position++;
		}
	}

	/**
	 * Drop the auto-generated `edit.php?post_type=newspack_nl_cpt` "All
	 * Newsletters" submenu so our React page (added as the first submenu)
	 * takes its visual slot. Uses direct `$submenu` manipulation rather than
	 * `remove_submenu_page` because the latter requires `is_admin()` and the
	 * exact same slug, which is fine here but harder to assert in tests.
	 */
	public static function replace_default_newsletters_submenu() {
		global $submenu;

		$parent = 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		if ( empty( $submenu[ $parent ] ) ) {
			return;
		}

		foreach ( $submenu[ $parent ] as $position => $entry ) {
			if ( isset( $entry[2] ) && $parent === $entry[2] ) {
				unset( $submenu[ $parent ][ $position ] );
			}
		}
	}

	/**
	 * Redirect legacy `edit.php?post_type=newspack_nl_cpt` GET requests
	 * (deep links, browser history, third-party menu links) to the React
	 * page. Only redirects clean GETs so bulk-action POSTs and trash-view
	 * links keep working should anyone hit them directly.
	 *
	 * @param \WP_Screen $screen Current screen.
	 */
	public static function maybe_redirect_legacy_list( $screen ) {
		if ( ! is_admin() || ! $screen instanceof \WP_Screen ) {
			return;
		}
		if ( 'edit-' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT !== $screen->id ) {
			return;
		}
		if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || 'GET' !== $_SERVER['REQUEST_METHOD'] ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only nav check.
		if ( ! empty( $_GET['action'] ) || ! empty( $_GET['post_status'] ) ) {
			// Preserve trash filters and bulk-edit actions if they ever surface.
			return;
		}

		wp_safe_redirect( self::get_legacy_redirect_target() );
		exit;
	}

	/**
	 * Target URL for the legacy redirect. Exposed so tests can assert against
	 * it without invoking `wp_safe_redirect`.
	 *
	 * @return string
	 */
	public static function get_legacy_redirect_target() {
		return admin_url(
			'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '&page=newspack-newsletters-list'
		);
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
				'classicSettings' => \Newspack_Newsletters_Settings::get_settings_url(),
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
		$pages = [
			new Pages\Newsletters_List_Page(),
		];

		if ( ! self::is_bundled_mode() ) {
			$pages[] = new Pages\Settings_Page();
		}

		return $pages;
	}
}

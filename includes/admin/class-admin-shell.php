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
		add_action( 'current_screen', [ __CLASS__, 'maybe_redirect_legacy_list' ] );
		add_filter( 'admin_body_class', [ __CLASS__, 'add_body_class' ] );
		add_filter( 'parent_file', [ __CLASS__, 'highlight_parent_menu' ] );
		add_filter( 'submenu_file', [ __CLASS__, 'highlight_submenu' ] );
	}

	/**
	 * Force the Newsletters CPT to be the active top-level menu when on a
	 * chassis-managed page. Without this, our hidden (parent=null) submenus
	 * leave WP unable to resolve the active parent.
	 *
	 * @param string $parent_file The current parent file value.
	 * @return string
	 */
	public static function highlight_parent_menu( $parent_file ) {
		if ( self::get_current_page() ) {
			return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		}
		return $parent_file;
	}

	/**
	 * Highlight the auto-generated "All Newsletters" submenu for the list
	 * page. NEWS-1929/30/31 will add their own cases as their pages land.
	 *
	 * @param string $submenu_file The current submenu file value.
	 * @return string
	 */
	public static function highlight_submenu( $submenu_file ) {
		$page = self::get_current_page();
		if ( ! $page ) {
			return $submenu_file;
		}
		if ( 'newspack-newsletters-list' === $page->get_slug() ) {
			return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		}
		return $submenu_file;
	}

	/**
	 * Add a body class on chassis-managed admin pages so our SCSS can scope
	 * the white-canvas styling without bleeding into other admin screens.
	 *
	 * @param string $classes Existing body classes (space-separated).
	 * @return string
	 */
	public static function add_body_class( $classes ) {
		if ( self::get_current_page() ) {
			$classes .= ' newspack-newsletters-admin-screen';
		}
		return $classes;
	}

	/**
	 * Register React-shell pages as hidden submenus.
	 *
	 * Hidden (parent=null) is deliberate: we want the auto-generated
	 * `edit.php?post_type=newspack_nl_cpt` "All Newsletters" submenu to stay
	 * as the visible link target. `maybe_redirect_legacy_list` then 302's
	 * that URL to our React page (`?page=newspack-newsletters-list`) — and
	 * because the redirect preserves `?post_type=newspack_nl_cpt`,
	 * `newspack-plugin`'s `Newsletters_Wizard` (when present) recognises the
	 * screen and renders the dark Newspack admin-header chrome on top of
	 * our React surface. Removing the auto submenu broke that recognition
	 * and routed the top-level menu link to `admin.php?page=...`, which is
	 * not in the wizard's `admin_screens` map.
	 */
	public static function register_menu() {
		foreach ( self::get_pages() as $page ) {
			add_submenu_page(
				null,
				$page->get_label(),
				$page->get_label(),
				$page->get_capability(),
				$page->get_slug(),
				[ $page, 'render' ]
			);
		}
	}

	/**
	 * Redirect legacy `edit.php?post_type=newspack_nl_cpt` GET requests
	 * (deep links, browser history, third-party menu links) to the React
	 * page. Form-submission GETs that carry `?action=` are left alone so
	 * any classic admin flows continue to work. The `post_status` query
	 * arg, if present, is forwarded so the React page can pre-fill its
	 * status filter from URL state (see the JS-side initial filters).
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
		if ( ! empty( $_GET['action'] ) ) {
			// Defensive: leave any GET-with-action flow alone.
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only nav check.
		$post_status = isset( $_GET['post_status'] ) ? sanitize_key( wp_unslash( $_GET['post_status'] ) ) : '';
		wp_safe_redirect( self::get_legacy_redirect_target( $post_status ) );
		exit;
	}

	/**
	 * Target URL for the legacy redirect. Exposed so tests can assert against
	 * it without invoking `wp_safe_redirect`. When `$post_status` is
	 * provided, it's forwarded so the React page can pre-fill its filter.
	 *
	 * @param string $post_status Optional `post_status` value to forward.
	 * @return string
	 */
	public static function get_legacy_redirect_target( $post_status = '' ) {
		$args = [
			'post_type' => Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			'page'      => 'newspack-newsletters-list',
		];
		if ( $post_status ) {
			$args['post_status'] = $post_status;
		}
		return add_query_arg( $args, admin_url( 'edit.php' ) );
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
				// Pass `admin_url()` so JS doesn't have to assume `/wp-admin/`
				// lives at the document origin — subdirectory installs and
				// some multisite setups put it under a path.
				'adminUrl'        => esc_url_raw( admin_url() ),
				'cptSlug'         => Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
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

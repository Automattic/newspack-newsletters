<?php
/**
 * Admin shell bootstrap.
 *
 * Provides the React mount infrastructure (asset enqueue, page
 * registry, mode detection) the list-screen pages plug into. The
 * chassis itself does not introduce its own top-level menu — pages
 * register as submenus under the Newsletters CPT menu so the
 * existing menu structure is preserved.
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
		Admin_Shell_Menu::init();
		Admin_Shell_Legacy_Redirect::init();
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );
		// Priority 99 so we run after newspack-plugin's wizard header
		// has registered its script — `wp_add_inline_script` needs the
		// handle in place to attach.
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'patch_wizard_header_active_tab' ], 99 );
		add_filter( 'admin_body_class', [ __CLASS__, 'add_body_class' ] );
		add_filter( 'parent_file', [ __CLASS__, 'highlight_parent_menu' ] );
		add_filter( 'submenu_file', [ __CLASS__, 'highlight_submenu' ] );
	}

	/**
	 * Filter the global `parent_file` so the sidebar's top-level menu
	 * highlights correctly while a chassis-managed page is rendered.
	 * Each page declares its own override via `Admin_Page::get_parent_file()`
	 * — that's where the dynamic logic lives (e.g. ads switching
	 * between top-level and submenu mode based on user caps).
	 *
	 * @param string $parent_file The current parent file value.
	 * @return string
	 */
	public static function highlight_parent_menu( $parent_file ) {
		$page = self::get_current_page();
		if ( $page ) {
			$override = $page->get_parent_file();
			if ( null !== $override ) {
				return $override;
			}
		}
		return $parent_file;
	}

	/**
	 * Filter the global `submenu_file` so the active submenu entry
	 * matches the page on screen. Each page declares its own override
	 * via `Admin_Page::get_submenu_file()`; visible submenus typically
	 * return `null` (WP's auto-detection is correct), while hidden
	 * React pages name the auto-generated CPT submenu they shadow.
	 *
	 * @param string $submenu_file The current submenu file value.
	 * @return string
	 */
	public static function highlight_submenu( $submenu_file ) {
		$page = self::get_current_page();
		if ( $page ) {
			$override = $page->get_submenu_file();
			if ( null !== $override ) {
				return $override;
			}
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
		if ( ! self::get_current_page() ) {
			return $classes;
		}
		$classes .= ' newspack-newsletters-admin-screen';
		if ( self::is_bundled_mode() ) {
			$classes .= ' newspack-newsletters-admin-screen--bundled';
		}
		return $classes;
	}

	/**
	 * Enqueue the shared admin-shell bundle on registered admin pages.
	 * Pages contribute style deps via `get_admin_shell_style_deps()` and
	 * sibling enqueues via `enqueue_extras()` so this method stays
	 * branch-free.
	 *
	 * @param string $hook_suffix Current admin page hook suffix.
	 */
	public static function enqueue_assets( $hook_suffix ) {
		$current_page = self::get_current_page();
		if ( ! $current_page ) {
			return;
		}
		unset( $hook_suffix );

		$asset = Asset_Loader::enqueue_bundle(
			self::SCRIPT_HANDLE,
			'admin-shell',
			NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist',
			plugins_url( '../../dist', __FILE__ ),
			[],
			$current_page->get_admin_shell_style_deps()
		);
		if ( ! $asset ) {
			return;
		}

		$current_page->enqueue_extras( self::SCRIPT_HANDLE );

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
				// `admin_url()` rather than assuming `/wp-admin/` lives at the document origin — subdirectory and multisite installs put it under a path.
				'adminUrl'        => esc_url_raw( admin_url() ),
				'cptSlug'         => Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			]
		);
	}

	/**
	 * Patch the newspack-plugin wizard header's "selected" tab state
	 * for hidden React subpages. The wizard's `WizardsAdminHeader`
	 * (`src/wizards/admin-header/index.tsx`) decides the active tab
	 * via strict `window.location.href === tab.href` equality, which
	 * breaks for our hidden React subpages — the live URL has an
	 * extra `&page=…` query the tab href doesn't carry. Each page
	 * declares the canonical tab URL via `get_wizard_tab_url()`; we
	 * inject a tiny inline script after the wizard header script to
	 * flip the matching `<a>` to `.selected` once the React component
	 * has mounted. Runs only when the wizard header script is
	 * registered (i.e. bundled mode + the wizard recognises the
	 * screen — for ads, that's via `Newsletters_Wizard::get_tabs()`).
	 *
	 * Upstream fix tracked separately; the wizard's URL-equality
	 * check should accept subpages so this workaround can be removed.
	 */
	public static function patch_wizard_header_active_tab() {
		$current_page = self::get_current_page();
		if ( ! $current_page ) {
			return;
		}
		if ( ! wp_script_is( 'newspack-wizards-admin-header', 'registered' ) ) {
			return;
		}

		$tab_url           = $current_page->get_wizard_tab_url();
		$breadcrumb_label  = $current_page->get_wizard_header_label();

		if ( null === $tab_url && null === $breadcrumb_label ) {
			return;
		}

		// Single inline-script payload covers both patches. Each runs
		// independently — the wizard renders its DOM after this script is
		// parsed, so we observe document.body and re-apply on every
		// mutation until the targets exist (and once after, to defend
		// against React rerenders that swap the nodes).
		$tab_url_json    = null === $tab_url ? 'null' : wp_json_encode( $tab_url );
		$breadcrumb_json = null === $breadcrumb_label ? 'null' : wp_json_encode( $breadcrumb_label );

		// The wizard renders its DOM after this script is parsed and may
		// re-render its header on route changes, so the observer waits
		// for the targets, patches once both are present, and then
		// disconnects. A deferred follow-up apply() run catches an
		// immediate post-mount rerender without leaving the observer
		// attached for the lifetime of the page.
		wp_add_inline_script(
			'newspack-wizards-admin-header',
			sprintf(
				'( function () {
					var tabUrl = %1$s;
					var breadcrumb = %2$s;
					var observer = null;
					function apply() {
						var tabDone = ! tabUrl;
						var breadcrumbDone = ! breadcrumb;
						if ( tabUrl ) {
							var links = document.querySelectorAll( ".newspack-tabbed-navigation a" );
							links.forEach( function ( link ) {
								if ( link.href === tabUrl ) {
									link.classList.add( "selected" );
								}
							} );
							tabDone = links.length > 0;
						}
						if ( breadcrumb ) {
							var heading = document.querySelector( ".newspack-wizard__title h2" );
							if ( heading ) {
								if ( heading.textContent !== breadcrumb ) {
									heading.textContent = breadcrumb;
								}
								breadcrumbDone = true;
							}
						}
						if ( tabDone && breadcrumbDone && observer ) {
							observer.disconnect();
							observer = null;
							setTimeout( function () {
								apply();
							}, 0 );
						}
					}
					apply();
					var root = document.querySelector( ".newspack-wizard" ) || document.body;
					observer = new MutationObserver( apply );
					observer.observe( root, { childList: true, subtree: true } );
				} )();',
				$tab_url_json,
				$breadcrumb_json
			)
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
			new Pages\Ads_List_Page(),
			new Pages\Advertisers_List_Page(),
			new Pages\Layouts_List_Page(),
		];

		if ( ! self::is_bundled_mode() ) {
			$pages[] = new Pages\Settings_Page();
		}

		return $pages;
	}
}

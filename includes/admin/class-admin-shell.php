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
		add_action( 'admin_menu', [ __CLASS__, 'register_menu' ] );
		// Priority 999 so we run after every contributor has registered
		// (auto-generated CPT submenus, ads, third-party plugins).
		// Reordering earlier wouldn't be stable — a later registration
		// would just append past us.
		add_action( 'admin_menu', [ __CLASS__, 'reorder_submenus' ], 999 );
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ] );
		// Priority 99 so we run after newspack-plugin's wizard header
		// has registered its script — `wp_add_inline_script` needs the
		// handle in place to attach.
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'patch_wizard_header_active_tab' ], 99 );
		add_action( 'current_screen', [ __CLASS__, 'maybe_redirect_legacy_list' ] );
		add_filter( 'admin_body_class', [ __CLASS__, 'add_body_class' ] );
		add_filter( 'parent_file', [ __CLASS__, 'highlight_parent_menu' ] );
		add_filter( 'submenu_file', [ __CLASS__, 'highlight_submenu' ] );
	}

	/**
	 * Reposition chassis submenu entries that declare a fixed index.
	 *
	 * Fires on `admin_menu` at priority 999 — after every other
	 * `add_submenu_page` call, including auto-generated CPT submenus
	 * (`_add_post_type_submenus`) and third-party additions. For each
	 * page that returns a non-null `get_submenu_index()`, the entry is
	 * unset from its current numeric key in `$submenu[ $parent_slug ]`
	 * and re-inserted at the desired array index. Re-keying with
	 * `array_values()` guarantees a clean 0-based sequence so WP's
	 * downstream sorting doesn't reshuffle us back.
	 */
	public static function reorder_submenus() {
		global $submenu;
		foreach ( self::get_pages() as $page ) {
			$desired_index = $page->get_submenu_index();
			if ( null === $desired_index ) {
				continue;
			}
			$parent_slug = $page->get_parent_slug();
			if ( empty( $submenu[ $parent_slug ] ) ) {
				continue;
			}

			// Snapshot to a 0-based list so index arithmetic is
			// predictable. WP keeps numeric keys (5, 10, …) on auto
			// submenus; the slug index lookup below is key-agnostic.
			$entries = array_values( $submenu[ $parent_slug ] );

			$found_at = null;
			foreach ( $entries as $idx => $entry ) {
				if ( ( $entry[2] ?? '' ) === $page->get_slug() ) {
					$found_at = $idx;
					break;
				}
			}
			if ( null === $found_at ) {
				continue;
			}

			$entry = $entries[ $found_at ];
			array_splice( $entries, $found_at, 1 );
			$insert = max( 0, min( $desired_index, count( $entries ) ) );
			array_splice( $entries, $insert, 0, [ $entry ] );

			// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Reordering an admin-menu structure that WP itself populates this global with.
			$submenu[ $parent_slug ] = $entries;
		}
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
	 * Register React-shell pages.
	 *
	 * Every page registers under a concrete parent slug returned by
	 * `get_parent_slug()` — passing `null` is unsafe because WP's
	 * `get_plugin_page_hookname` mixes the parent into the registered
	 * hookname, and `add_submenu_page`'s registration- and `admin.php`'s
	 * URL-derived lookup-time resolution can drift when the parent
	 * isn't itself a top-level menu. Pages that should be invisible
	 * still register, then opt in to `is_hidden_from_menu()` so
	 * `remove_submenu_page` strips the menu entry after registration —
	 * keeping the URL routable while leaving no sidebar entry. The
	 * list views use this to shadow the auto-generated `edit.php?
	 * post_type=…` submenus, which `maybe_redirect_legacy_list` then
	 * 302s to the React page; because the redirect preserves the
	 * `post_type` query, `newspack-plugin`'s `Newsletters_Wizard`
	 * (when present) recognises the screen and renders the dark
	 * Newspack admin-header chrome on top.
	 *
	 * Pages that should remain visible (e.g. Settings in standalone
	 * mode) leave `is_hidden_from_menu()` at its default and surface
	 * as normal submenus under their declared parent.
	 */
	public static function register_menu() {
		global $_registered_pages;
		foreach ( self::get_pages() as $page ) {
			$parent_slug = $page->get_parent_slug();
			add_submenu_page(
				$parent_slug,
				$page->get_label(),
				$page->get_label(),
				$page->get_capability(),
				$page->get_slug(),
				[ $page, 'render' ]
			);
			if ( $page->is_hidden_from_menu() ) {
				// Hidden React pages (the list views) shadow a classic
				// CPT URL via `Admin_Shell::maybe_redirect_legacy_list`.
				// `add_submenu_page` registers the callback under the
				// hookname WP computes from the page's parent — that
				// matches `user_can_access_admin_page`'s access check
				// (which resolves the parent the same way), but
				// **doesn't** match `admin.php`'s page-render lookup
				// at line ~182, which uses the URL-derived parent
				// (`edit.php?post_type=$typenow`). When the typenow
				// CPT isn't itself a top-level menu (true for the ads
				// CPT in submenu mode), `$admin_page_hooks` doesn't
				// carry it and the URL-derived hookname falls back to
				// the `admin_page_*` prefix. Mirror the action under
				// that prefix so `admin.php` finds and dispatches it.
				$shadow_hookname = 'admin_page_' . $page->get_slug();
				if ( ! has_action( $shadow_hookname ) ) {
					add_action( $shadow_hookname, [ $page, 'render' ] );
					// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Mirroring an admin-page registration that WP itself populates this global with on `add_submenu_page`. The standard WordPress.WP.GlobalVariablesOverride rule guards against accidental clobbers; we add (not replace) one entry whose hookname is unique to this plugin.
					$_registered_pages[ $shadow_hookname ] = true;
				}
				// Strip the visible submenu the registration produced —
				// the user-facing entry is the auto-generated CPT
				// submenu we redirect from, not a separate React link.
				remove_submenu_page( $parent_slug, $page->get_slug() );
			}
		}
	}

	/**
	 * Query args we forward from the legacy URL onto the React page so the
	 * JS side can seed initial view state. `paged` is deliberately
	 * omitted — the legacy WP list table uses 20 items per page while the
	 * DataView defaults to 25, so a `paged=N` carry-over would point at
	 * the wrong slice anyway. Stick to filter / search / sort args that
	 * map cleanly onto DataViews state.
	 */
	const FORWARDED_LEGACY_ARGS = [
		'post_status',
		's',
		'orderby',
		'order',
		'author',
		'categories',
		'tags',
		'newspack_newsletters_send_list_id',
	];

	/**
	 * Are any of the bulk-action selectors set to a real value (i.e. not
	 * the `-1` "no action selected" sentinel WP submits when the user
	 * leaves the dropdown alone)? Both `action` (top-of-table dropdown)
	 * and `action2` (bottom-of-table dropdown) are checked.
	 *
	 * @return bool
	 */
	private static function has_real_get_action() {
		foreach ( [ 'action', 'action2' ] as $key ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only nav check.
			if ( ! isset( $_GET[ $key ] ) ) {
				continue;
			}
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only nav check.
			$value = sanitize_text_field( wp_unslash( $_GET[ $key ] ) );
			if ( '' !== $value && '-1' !== $value ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Redirect legacy CPT list GET requests (deep links, browser
	 * history, third-party menu links) to the matching React page.
	 * Each chassis page declares its legacy screen id and redirect
	 * target — this handler iterates pages and lets the matching one
	 * supply the destination. Form-submission GETs that carry
	 * `?action=` are left alone so classic admin flows continue to
	 * work. Filter / search / sort args are forwarded so the React
	 * page can pre-fill view state — see `getInitialView` on the JS
	 * side.
	 *
	 * @param \WP_Screen $screen Current screen.
	 */
	public static function maybe_redirect_legacy_list( $screen ) {
		if ( ! is_admin() || ! $screen instanceof \WP_Screen ) {
			return;
		}
		if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || 'GET' !== $_SERVER['REQUEST_METHOD'] ) {
			return;
		}

		$matching_page = null;
		foreach ( self::get_pages() as $page ) {
			if ( $screen->id === $page->get_legacy_screen_id() ) {
				$matching_page = $page;
				break;
			}
		}
		if ( ! $matching_page ) {
			return;
		}

		// `action=-1` (and the bottom dropdown's `action2=-1`) is WP's
		// "no bulk action selected" sentinel — typically left in the URL
		// after the user submits the bulk-actions form without picking
		// one. Treat it as a no-op so those stale URLs still redirect to
		// the React page; only bypass for real action values.
		if ( self::has_real_get_action() ) {
			return;
		}

		$forwarded = [];
		foreach ( self::FORWARDED_LEGACY_ARGS as $key ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only nav check.
			if ( ! isset( $_GET[ $key ] ) ) {
				continue;
			}
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended,WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitised below.
			$value = wp_unslash( $_GET[ $key ] );
			if ( '' === $value ) {
				continue;
			}
			$forwarded[ $key ] = is_array( $value ) ? array_map( 'sanitize_text_field', $value ) : sanitize_text_field( $value );
		}

		$target = $matching_page->get_legacy_redirect_target( $forwarded );
		if ( ! $target ) {
			return;
		}

		wp_safe_redirect( $target );
		exit;
	}

	/**
	 * Build a redirect target URL for a chassis-managed page.
	 * Centralises the `?post_type=…&page=…&<forwarded>` shape so each
	 * page only has to hand over its CPT slug + page slug.
	 *
	 * @param string       $post_type CPT slug the page shadows.
	 * @param string       $page_slug The React page's `?page=` slug.
	 * @param array|string $forwarded Forwarded query args, or a `post_status` string.
	 * @return string
	 */
	public static function build_legacy_redirect_target( $post_type, $page_slug, $forwarded = [] ) {
		$args = [
			'post_type' => $post_type,
			'page'      => $page_slug,
		];

		if ( is_string( $forwarded ) ) {
			$forwarded = '' === $forwarded ? [] : [ 'post_status' => $forwarded ];
		}

		foreach ( self::FORWARDED_LEGACY_ARGS as $key ) {
			if ( ! empty( $forwarded[ $key ] ) ) {
				$args[ $key ] = $forwarded[ $key ];
			}
		}

		return add_query_arg( $args, admin_url( 'edit.php' ) );
	}

	/**
	 * Newsletters-list redirect target — kept for back-compat with
	 * existing tests. Equivalent to calling
	 * `Newsletters_List_Page::get_legacy_redirect_target()`.
	 *
	 * @param array|string $forwarded Forwarded query args, or a `post_status` string.
	 * @return string
	 */
	public static function get_legacy_redirect_target( $forwarded = [] ) {
		return self::build_legacy_redirect_target(
			Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			'newspack-newsletters-list',
			$forwarded
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

		$is_layouts_list = 'newspack-newsletters-layouts-list' === $current_page->get_slug();

		// `wp-edit-blocks` is only needed by the layouts-list BlockPreview iframes — keep it off other admin-shell pages.
		$admin_shell_css_deps = [];
		if ( $is_layouts_list ) {
			wp_enqueue_style( 'wp-edit-blocks' );
			$admin_shell_css_deps[] = 'wp-edit-blocks';
		}

		if ( file_exists( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/admin-shell.css' ) ) {
			wp_enqueue_style(
				self::SCRIPT_HANDLE,
				plugins_url( '../../dist/admin-shell.css', __FILE__ ),
				$admin_shell_css_deps,
				$asset['version']
			);
		}

		// Layouts list previews render `newspack-newsletters/posts-inserter`; without `editorBlocks.js` BlockPreview shows the "block not supported" fallback.
		if ( $is_layouts_list ) {
			// Localise on the admin-shell handle so the global is set before `admin-shell.js` runs — NewsletterPreview reads `sample_assets_url` at mount.
			wp_localize_script(
				self::SCRIPT_HANDLE,
				'newspack_email_editor_data',
				\Newspack_Newsletters_Editor::get_email_editor_data()
			);

			$blocks_js = NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/editorBlocks.js';
			if ( file_exists( $blocks_js ) ) {
				wp_enqueue_script(
					'newspack-newsletters-editor-blocks',
					plugins_url( '../../dist/editorBlocks.js', __FILE__ ),
					[],
					filemtime( $blocks_js ),
					true
				);
			}
			$blocks_css = NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/editorBlocks.css';
			if ( file_exists( $blocks_css ) ) {
				wp_enqueue_style(
					'newspack-newsletters-editor-blocks',
					plugins_url( '../../dist/editorBlocks.css', __FILE__ ),
					[],
					filemtime( $blocks_css )
				);
			}

			// theme.json compilation, passed to NewsletterPreview for in-iframe injection so the parent admin chrome isn't affected by its generic selectors.
			wp_add_inline_script(
				self::SCRIPT_HANDLE,
				'window.newspackNewslettersGlobalStyles = ' . wp_json_encode( wp_get_global_stylesheet() ) . ';',
				'before'
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

<?php
/**
 * Admin shell — menu registration.
 *
 * Owns the chassis-managed submenu entries and the
 * register-time hookname registry `Admin_Page::is_admin_page()`
 * consults at request time.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Admin menu + submenu registration.
 */
class Admin_Shell_Menu {
	/**
	 * Slug => hookname returned by `add_submenu_page`. Populated by
	 * `register_menu()` so `Admin_Page::is_admin_page()` survives the
	 * fresh page instances `Admin_Shell::get_pages()` returns on every
	 * call.
	 *
	 * @var array<string,string>
	 */
	private static $hook_suffixes = [];

	/**
	 * Lookup the registered hookname for a given page slug.
	 *
	 * @param string $slug Page slug.
	 * @return string Hookname, or `''` if the slug was not registered.
	 */
	public static function get_hook_suffix_for_slug( $slug ) {
		return isset( self::$hook_suffixes[ $slug ] ) ? self::$hook_suffixes[ $slug ] : '';
	}

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
		foreach ( Admin_Shell::get_pages() as $page ) {
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
		self::$hook_suffixes = [];
		foreach ( Admin_Shell::get_pages() as $page ) {
			$parent_slug = $page->get_parent_slug();
			$hook_suffix = add_submenu_page(
				$parent_slug,
				$page->get_label(),
				$page->get_label(),
				$page->get_capability(),
				$page->get_slug(),
				[ $page, 'render' ]
			);
			if ( is_string( $hook_suffix ) && '' !== $hook_suffix ) {
				$page->set_hook_suffix( $hook_suffix );
				self::$hook_suffixes[ $page->get_slug() ] = $hook_suffix;
			}
			if ( $page->is_hidden_from_menu() ) {
				// Hidden React pages (the list views) shadow a classic
				// CPT URL via `Admin_Shell_Legacy_Redirect::maybe_redirect_legacy_list`.
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
}

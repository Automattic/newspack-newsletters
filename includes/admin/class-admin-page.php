<?php
/**
 * Base class for React-based admin pages.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Abstract base for an admin page that mounts a React app.
 */
abstract class Admin_Page {
	/**
	 * Page slug. Override in subclasses.
	 *
	 * @var string
	 */
	protected $slug = '';

	/**
	 * Capability required to view the page.
	 *
	 * Defaults to `edit_posts` so users who could previously edit newsletters via
	 * the (now hidden) CPT menu retain access. Pages requiring elevated access —
	 * Settings being the canonical example — override this.
	 *
	 * @var string
	 */
	protected $capability = 'edit_posts';

	/**
	 * Get the page slug.
	 *
	 * @return string
	 */
	public function get_slug() {
		return $this->slug;
	}

	/**
	 * Get the page label shown in the admin menu.
	 *
	 * @return string
	 */
	abstract public function get_label();

	/**
	 * Get the capability required to view the page.
	 *
	 * @return string
	 */
	public function get_capability() {
		return $this->capability;
	}

	/**
	 * Parent menu slug for `add_submenu_page`.
	 *
	 * Override in subclasses to return the URL of the parent menu the
	 * page is registered under. WP's `get_plugin_page_hookname` mixes
	 * `$admin_page_hooks[ $parent_slug ]` into the hookname, so the
	 * value here has to match what the lookup at request time sees —
	 * passing `null` is unsafe because registration- and lookup-time
	 * resolution can drift. Hidden pages (`is_hidden_from_menu()`)
	 * register under the same parent then get unhooked from the
	 * sidebar after registration via `remove_submenu_page`, keeping
	 * the URL routable while staying invisible.
	 *
	 * @return string|null
	 */
	abstract public function get_parent_slug();

	/**
	 * Whether the page should be removed from the visible submenu list
	 * after registration. Default: visible. Hidden pages still register
	 * (URL routable) but `remove_submenu_page` strips the menu entry
	 * so it doesn't appear in the sidebar.
	 *
	 * @return bool
	 */
	public function is_hidden_from_menu() {
		return false;
	}

	/**
	 * `parent_file` override for menu-highlighting.
	 *
	 * `Admin_Shell::highlight_parent_menu` filters the global
	 * `parent_file` and delegates to this method when the current
	 * request resolves to this page. Return the URL of the top-level
	 * menu that should appear active (e.g.
	 * `'edit.php?post_type=newspack_nl_cpt'`), or `null` to let WP's
	 * native resolution stand. Pages hidden from the menu via
	 * `is_hidden_from_menu()` will typically need a non-null override
	 * so the sidebar doesn't collapse to an inactive state.
	 *
	 * @return string|null
	 */
	public function get_parent_file() {
		return null;
	}

	/**
	 * `submenu_file` override for menu-highlighting.
	 *
	 * Companion to `get_parent_file()`. Returns the URL of the
	 * specific submenu entry that should appear active when this page
	 * is rendered, or `null` to defer to WP's default resolution.
	 * Visible submenus (where `get_parent_slug()` returns a real
	 * value) usually return `null` because WP's auto-detection is
	 * correct; hidden React pages return the URL of the click-target
	 * submenu they shadow.
	 *
	 * @return string|null
	 */
	public function get_submenu_file() {
		return null;
	}

	/**
	 * `WP_Screen::id` of the classic CPT list this page shadows, or
	 * `null` when the page doesn't replace a legacy URL. Hidden React
	 * pages typically declare an id like `'edit-newspack_nl_cpt'` so
	 * `Admin_Shell::maybe_redirect_legacy_list` can 302 the legacy
	 * URL across to the React surface.
	 *
	 * @return string|null
	 */
	public function get_legacy_screen_id() {
		return null;
	}

	/**
	 * Build the URL the legacy CPT list redirects to for this page.
	 * Returns `null` when the page doesn't shadow a legacy URL — the
	 * redirect handler skips it. Forwarded args (filter / search /
	 * sort) are appended so the React side can seed its initial view.
	 *
	 * @param array $forwarded Forwarded query args.
	 * @return string|null
	 */
	public function get_legacy_redirect_target( $forwarded = [] ) {
		return null;
	}

	/**
	 * URL of the newspack-plugin admin-header tab whose `selected`
	 * state should reflect this page, or `null` when no patching is
	 * required. The wizard header (`WizardsAdminHeader`) decides which
	 * tab is active via strict `window.location.href === tab.href`
	 * equality, which breaks for hidden React subpages — the live URL
	 * has an extra `&page=…` query the tab href doesn't carry. Pages
	 * that are conceptually a subpage of an existing wizard tab
	 * override this; the chassis flips the matching `<a>` to selected
	 * via inline script after the React header mounts. Returning
	 * `null` is the right default — most pages either have no wizard
	 * tabs (the wizard's `get_tabs()` only renders them on the ads /
	 * advertisers screens) or are themselves the canonical tab URL.
	 *
	 * @return string|null
	 */
	public function get_wizard_tab_url() {
		return null;
	}

	/**
	 * Desired 0-based array index within the parent submenu list.
	 *
	 * Returning a non-null value triggers a late-priority pass over
	 * the global `$submenu` that physically reorders this page's
	 * entry. We can't lean on `add_submenu_page`'s `$position`
	 * argument because it keys on numeric positions that collide
	 * unpredictably with auto-registered CPT entries (`edit.php`
	 * adds "All Newsletters" and "Add New …" at runtime-derived
	 * keys, so passing position 3 doesn't reliably slot between
	 * them).
	 *
	 * @return int|null
	 */
	public function get_submenu_index() {
		return null;
	}

	/**
	 * Override the wizard header breadcrumb text for this page.
	 *
	 * Newspack-plugin's `Newsletters_Wizard` resolves the breadcrumb
	 * from its `admin_screens` map keyed on CPT / page / taxonomy
	 * slugs. For `edit.php?post_type=…&page=…` URLs the resolution
	 * prefers the post_type, so a hidden React subpage (or a visible
	 * submenu the wizard doesn't recognise) ends up showing the
	 * parent CPT's label. Pages can override here to inject the
	 * correct text via inline script after the wizard header mounts.
	 * Returning `null` defers to the wizard's own resolution.
	 *
	 * @return string|null
	 */
	public function get_wizard_header_label() {
		return null;
	}

	/**
	 * Whether the current request is for this admin page.
	 *
	 * @return bool
	 */
	public function is_admin_page() {
		if ( ! isset( $_GET['page'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return false;
		}
		return $this->slug === sanitize_text_field( wp_unslash( $_GET['page'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * DOM id used as the React mount node.
	 *
	 * @return string
	 */
	public function get_mount_id() {
		return $this->slug . '-root';
	}

	/**
	 * Render the React mount container.
	 */
	public function render() {
		printf(
			'<div id="%s" class="newspack-newsletters-admin-mount"></div>',
			esc_attr( $this->get_mount_id() )
		);
	}
}

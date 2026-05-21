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
	 * @var string
	 */
	protected $capability = 'edit_posts';

	/**
	 * Hookname returned by `add_submenu_page`, captured at registration.
	 *
	 * @var string
	 */
	protected $hook_suffix = '';

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
	 * Subclasses return a concrete value — passing `null` is unsafe
	 * because WP's hookname computation mixes the parent in and
	 * registration- and lookup-time resolution can drift.
	 *
	 * @return string|null
	 */
	abstract public function get_parent_slug();

	/**
	 * Whether the page should be unhooked from the visible submenu list.
	 *
	 * @return bool
	 */
	public function is_hidden_from_menu() {
		return false;
	}

	/**
	 * `parent_file` override for menu-highlighting; `null` defers to WP.
	 *
	 * @return string|null
	 */
	public function get_parent_file() {
		return null;
	}

	/**
	 * `submenu_file` override for menu-highlighting; `null` defers to WP.
	 *
	 * @return string|null
	 */
	public function get_submenu_file() {
		return null;
	}

	/**
	 * `WP_Screen::id` of the classic CPT list this page shadows.
	 *
	 * @return string|null
	 */
	public function get_legacy_screen_id() {
		return null;
	}

	/**
	 * Build the URL the legacy CPT list redirects to.
	 *
	 * @param array $forwarded Forwarded query args.
	 * @return string|null
	 */
	public function get_legacy_redirect_target( $forwarded = [] ) {
		return null;
	}

	/**
	 * URL of the newspack-plugin admin-header tab whose `selected`
	 * state should reflect this page.
	 *
	 * Override on hidden subpages whose live URL carries an extra
	 * `&page=…` the tab href doesn't — the wizard header's strict
	 * URL equality check would otherwise miss them.
	 *
	 * @return string|null
	 */
	public function get_wizard_tab_url() {
		return null;
	}

	/**
	 * Desired 0-based index within the parent submenu list.
	 *
	 * `add_submenu_page`'s `$position` is unreliable here — numeric
	 * positions collide with auto-registered CPT entries — so a
	 * late-priority pass over `$submenu` does the reordering.
	 *
	 * @return int|null
	 */
	public function get_submenu_index() {
		return null;
	}

	/**
	 * Override the wizard header breadcrumb text for this page.
	 *
	 * Newspack-plugin's wizard prefers `post_type` over `page` slug
	 * when resolving the breadcrumb, so a hidden React subpage ends
	 * up showing the parent CPT's label. Override to inject the
	 * correct text via inline script after the header mounts.
	 *
	 * @return string|null
	 */
	public function get_wizard_header_label() {
		return null;
	}

	/**
	 * Extra CSS deps for the admin-shell bundle — the only way to force
	 * load order relative to `admin-shell.css`.
	 *
	 * @return string[]
	 */
	public function get_admin_shell_style_deps() {
		return [];
	}

	/**
	 * Page-specific extras attached after the admin-shell bundle is
	 * registered under `$handle`.
	 *
	 * @param string $handle Admin-shell script handle.
	 */
	public function enqueue_extras( $handle ) {
		unset( $handle );
	}

	/**
	 * Store the hookname `add_submenu_page` returned at registration.
	 *
	 * @param string $hook_suffix Hookname.
	 */
	public function set_hook_suffix( $hook_suffix ) {
		$this->hook_suffix = (string) $hook_suffix;
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
		if ( $this->slug !== sanitize_text_field( wp_unslash( $_GET['page'] ) ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return false;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen ) {
			return false;
		}
		$hook_suffix = $this->hook_suffix ? $this->hook_suffix : Admin_Shell_Menu::get_hook_suffix_for_slug( $this->slug );
		// `admin_page_<slug>` is the shadow hookname used when the parent CPT isn't a top-level menu — see Admin_Shell_Menu::register_menu.
		$expected = array_filter( [ $hook_suffix, 'admin_page_' . $this->slug ] );
		return in_array( $screen->id, $expected, true );
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

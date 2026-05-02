<?php
/**
 * Newsletter Layouts list admin page (React DataView).
 *
 * First-class management surface for newsletter layouts. Lists the
 * bundled prebuilts (`Newspack_Newsletters_Layouts::get_default_layouts`)
 * alongside user-saved layouts (`newspack_nl_layo_cpt`); prebuilts
 * are read-only with Duplicate as the only available action, saved
 * rows expose edit / duplicate / rename / delete.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;
use Newspack_Newsletters;

defined( 'ABSPATH' ) || exit;

/**
 * "Layouts" list page — always registered (prebuilts ship with the plugin).
 */
class Layouts_List_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-layouts-list';

	/**
	 * Capability required to view the page.
	 *
	 * Matches the gate `Newspack_Newsletters_Layouts::register_layout_cpt`
	 * applies to the CPT itself — without `edit_others_posts` the CPT
	 * isn't registered, so the standard `/wp/v2/newspack_nl_layo_cpt`
	 * REST collection wouldn't be reachable. Aligning the page
	 * capability prevents an "I can see the menu but everything 404s"
	 * mismatch.
	 *
	 * @var string
	 */
	protected $capability = 'edit_others_posts';

	/**
	 * Get the page label.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'Layouts', 'newspack-newsletters' );
	}

	/**
	 * Submenu under the Newsletters CPT menu — same parent the existing
	 * chassis pages register against. The layouts CPT itself is
	 * `'public' => false` and has no menu entry of its own, so there is
	 * no legacy admin URL to shadow.
	 *
	 * @return string
	 */
	public function get_parent_slug() {
		return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * Slot the Layouts entry as the third submenu (0-based index 2) —
	 * directly after the auto-generated "All Newsletters" (0) and
	 * "Add New Newsletter" (1) entries, ahead of "Advertising",
	 * "Premium", and "Settings". Reordering happens at a late
	 * `admin_menu` priority so every other contributor has already
	 * registered.
	 *
	 * @return int
	 */
	public function get_submenu_index() {
		return 2;
	}

	/**
	 * Override the wizard breadcrumb so the dark Newspack header shows
	 * "Newsletters / Layouts" rather than the parent CPT's
	 * "Newsletters / All Newsletters". The wizard's `admin_screens`
	 * map keys on the CPT slug for `edit.php` URLs and resolves the
	 * breadcrumb from there; an upstream fix would prefer the page
	 * slug when both match. Until then this label is patched into
	 * the rendered DOM via the chassis-injected inline script.
	 *
	 * @return string
	 */
	public function get_wizard_header_label() {
		return __( 'Newsletters / Layouts', 'newspack-newsletters' );
	}
}

<?php
/**
 * Newsletter Layouts list admin page (React DataView).
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
	 * Capability required to view the page. Matches the CPT registration
	 * gate so the page and the REST collection align (avoids "menu visible
	 * but everything 404s").
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
	 * Submenu under the Newsletters CPT menu.
	 *
	 * @return string
	 */
	public function get_parent_slug() {
		return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * Classic CPT list screen the React page shadows. Catches the back
	 * button in the layout editor.
	 *
	 * @return string|null
	 */
	public function get_legacy_screen_id() {
		// Guard against a load-order regression fatalling every wp-admin request.
		if ( ! class_exists( '\Newspack_Newsletters_Layouts' ) ) {
			return null;
		}
		return 'edit-' . \Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT;
	}

	/**
	 * The React page lives under the newsletters CPT menu, not the layouts
	 * CPT — that's the `post_type` arg used here.
	 *
	 * @param array $forwarded Forwarded query args.
	 * @return string
	 */
	public function get_legacy_redirect_target( $forwarded = [] ) {
		return \Newspack\Newsletters\Admin\Admin_Shell::build_legacy_redirect_target(
			Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			$this->slug,
			$forwarded
		);
	}

	/**
	 * Slot directly after the auto-generated "All Newsletters" / "Add
	 * New Newsletter" submenus (indices 0 and 1).
	 *
	 * @return int
	 */
	public function get_submenu_index() {
		return 2;
	}

	/**
	 * Wizard breadcrumb label.
	 *
	 * @return string
	 */
	public function get_wizard_header_label() {
		return __( 'Newsletters / Layouts', 'newspack-newsletters' );
	}
}

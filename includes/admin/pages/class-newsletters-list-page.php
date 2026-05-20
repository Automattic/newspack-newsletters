<?php
/**
 * Newsletters list admin page (React DataView).
 *
 * Replaces the classic WP_List_Table for the newsletters CPT in both
 * standalone and bundled modes. The slug deliberately lives under the
 * existing CPT menu so the menu structure is preserved.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack_Newsletters;

defined( 'ABSPATH' ) || exit;

/**
 * "All Newsletters" page — registered in both modes.
 */
class Newsletters_List_Page extends Hidden_React_List_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-list';

	/**
	 * Get the page label.
	 *
	 * Matches the auto-generated CPT submenu label so the menu reads
	 * identically before and after the swap.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'All Newsletters', 'newspack-newsletters' );
	}

	/**
	 * Register under the newsletters CPT parent. `Admin_Shell::register_menu`
	 * removes the visible submenu after registration because
	 * `is_hidden_from_menu()` returns true (inherited from
	 * `Hidden_React_List_Page`).
	 *
	 * @return string
	 */
	public function get_parent_slug() {
		return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * The list page's visible click target is the auto-generated
	 * "All Newsletters" submenu — point `submenu_file` there so it
	 * appears highlighted while the React page is on screen.
	 *
	 * @return string
	 */
	public function get_submenu_file() {
		return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * Classic CPT list screen the React page shadows.
	 *
	 * @return string
	 */
	public function get_legacy_screen_id() {
		return 'edit-' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * Post type the React page lives under in the admin URL.
	 *
	 * @return string
	 */
	public function get_redirect_post_type() {
		return Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}
}

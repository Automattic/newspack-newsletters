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

use Newspack\Newsletters\Admin\Admin_Page;
use Newspack_Newsletters;

defined( 'ABSPATH' ) || exit;

/**
 * "All Newsletters" page — registered in both modes (NEWS-1928).
 */
class Newsletters_List_Page extends Admin_Page {
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
	 * `is_hidden_from_menu()` returns true here.
	 *
	 * @return string
	 */
	public function get_parent_slug() {
		return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * The visible click target is the auto-generated "All Newsletters"
	 * submenu — our React page lives behind a redirect, not a separate
	 * sidebar entry.
	 *
	 * @return bool
	 */
	public function is_hidden_from_menu() {
		return true;
	}

	/**
	 * Force the Newsletters CPT to be the active top-level menu while
	 * the React list page is rendered. The page registers under the
	 * CPT parent and is then hidden via `is_hidden_from_menu()` /
	 * `remove_submenu_page`, so we still need to keep the parent menu
	 * highlighted explicitly — otherwise the sidebar would collapse
	 * to an inactive state once the matching submenu entry is gone.
	 *
	 * @return string
	 */
	public function get_parent_file() {
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
	 * Build the redirect URL for the legacy newsletters CPT list.
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
}

<?php
/**
 * Abstract hidden React list-page base.
 *
 * Adds the "registered but invisible" submenu plumbing on top of
 * `React_List_Page`: the page is routable via its slug but stripped
 * from the sidebar by `Admin_Shell::register_menu`. Subclasses keep
 * `get_parent_slug()` (mode-aware) and `get_submenu_file()` (target
 * of the highlight); this base defaults `get_parent_file()` to the
 * same URL as `get_parent_slug()`, which is the right answer for
 * every hidden React page in the milestone.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

defined( 'ABSPATH' ) || exit;

/**
 * Base for hidden-submenu React list pages.
 */
abstract class Hidden_React_List_Page extends React_List_Page {
	/**
	 * Hidden from the sidebar — accessed by 302ing the legacy URL.
	 *
	 * @return bool
	 */
	public function is_hidden_from_menu() {
		return true;
	}

	/**
	 * Highlight the same top-level entry the page is registered under.
	 * Mirroring `get_parent_slug()` is the right default for every
	 * hidden React page in the milestone; subclasses can override for
	 * a different highlight target.
	 *
	 * @return string
	 */
	public function get_parent_file() {
		return $this->get_parent_slug();
	}
}

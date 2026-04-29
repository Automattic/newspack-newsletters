<?php
/**
 * Newsletter Ads list admin page (React DataView).
 *
 * Replaces the classic WP_List_Table for the ads CPT in both standalone
 * and bundled modes. The page registers as a hidden React submenu
 * (`parent=null`); the visible click target is the auto-generated
 * `edit.php?post_type=newspack_nl_ads_cpt` entry, which `Ads::add_ads_page`
 * already places either as a top-level menu or as a submenu under the
 * Newsletters CPT depending on the user's caps. `Admin_Shell::maybe_redirect_legacy_list`
 * 302s the legacy URL to the React page.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;
use Newspack_Newsletters;
use Newspack_Newsletters\Ads;

defined( 'ABSPATH' ) || exit;

/**
 * "Newsletter Ads" list page — registered in both modes (NEWS-1930).
 */
class Ads_List_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-ads-list';

	/**
	 * Get the page label.
	 *
	 * Matches the auto-generated CPT label so the menu reads
	 * identically before and after the swap.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'Newsletter Ads', 'newspack-newsletters' );
	}

	/**
	 * Register under the parent WP resolves to at access-check time
	 * (`user_can_access_admin_page` → `get_admin_page_parent`), which
	 * is mode-dependent:
	 *
	 * - Top-level mode: `Ads::add_ads_page` calls `add_menu_page` for
	 *   the ads CPT URL, so it's a top-level menu and the resolution
	 *   returns the ads CPT URL itself.
	 * - Submenu mode: the ads CPT URL is a submenu of the newsletters
	 *   CPT, so the resolution returns the newsletters CPT URL.
	 *
	 * `Ads::init_hooks()` runs before `Admin_Shell::init()` (see
	 * `newspack-newsletters.php` require order), so by the time we
	 * register here the ads menu placement has happened.
	 *
	 * @return string
	 */
	public function get_parent_slug() {
		if ( Ads::display_ads_menu_item_separately() ) {
			return 'edit.php?post_type=' . Ads::CPT;
		}
		return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * The visible click target is `Ads::add_ads_page`'s entry — our
	 * React page lives behind a redirect, not a separate sidebar entry.
	 *
	 * @return bool
	 */
	public function is_hidden_from_menu() {
		return true;
	}

	/**
	 * Active top-level menu while the ads list page is rendered.
	 *
	 * `Ads::add_ads_page` registers the visible ads entry as either a
	 * top-level menu (when the user can edit ads but not newsletters)
	 * or as a submenu under the Newsletters CPT (the common case).
	 * Highlight matches: in top-level mode the parent IS the ads CPT
	 * URL itself; in submenu mode the parent is the Newsletters CPT.
	 *
	 * @return string
	 */
	public function get_parent_file() {
		if ( Ads::display_ads_menu_item_separately() ) {
			return 'edit.php?post_type=' . Ads::CPT;
		}
		return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * Submenu entry to highlight while the ads list page is rendered.
	 *
	 * Always points at the ads CPT URL — that's the visible click
	 * target whether `Ads::add_ads_page` placed it as a top-level
	 * menu (which adds itself as the first submenu under itself) or
	 * as a submenu under the Newsletters CPT.
	 *
	 * @return string
	 */
	public function get_submenu_file() {
		return 'edit.php?post_type=' . Ads::CPT;
	}

	/**
	 * Classic CPT list screen the React page shadows.
	 *
	 * @return string
	 */
	public function get_legacy_screen_id() {
		return 'edit-' . Ads::CPT;
	}

	/**
	 * Build the redirect URL for the legacy ads CPT list.
	 *
	 * @param array $forwarded Forwarded query args.
	 * @return string
	 */
	public function get_legacy_redirect_target( $forwarded = [] ) {
		return \Newspack\Newsletters\Admin\Admin_Shell::build_legacy_redirect_target(
			Ads::CPT,
			$this->slug,
			$forwarded
		);
	}
}

<?php
/**
 * Newsletter Ads list admin page (React DataView).
 *
 * Replaces the classic WP_List_Table for the ads CPT in both standalone
 * and bundled modes. The page registers under the concrete parent slug
 * returned by `get_parent_slug()` — either the ads CPT entry as a
 * top-level menu or the Newsletters CPT entry when the ads screen is
 * grouped underneath it. The React page is kept out of the visible menu
 * via the inherited `is_hidden_from_menu()`; the visible click target
 * remains the auto-generated `edit.php?post_type=newspack_nl_ads_cpt`
 * entry that `Ads::add_ads_page` creates. `Admin_Shell::maybe_redirect_legacy_list`
 * 302s the legacy URL to the React page.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack_Newsletters;
use Newspack_Newsletters\Ads;

defined( 'ABSPATH' ) || exit;

/**
 * "Newsletter Ads" list page — registered in both modes.
 */
class Ads_List_Page extends Hidden_React_List_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-ads-list';

	/**
	 * Get the page label.
	 *
	 * Matches the ads CPT's `menu_name` label rather than `all_items`
	 * — keeps the React page title short ("Newsletter Ads" instead of
	 * "All Newsletter Ads"). Intentionally diverges from
	 * `Newsletters_List_Page`'s `all_items` convention; the visible
	 * click target is the auto-generated CPT submenu, so this label
	 * only surfaces as the React page's `<h1>` and the browser tab.
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
	 * Post type the React page lives under in the admin URL.
	 *
	 * @return string
	 */
	public function get_redirect_post_type() {
		return Ads::CPT;
	}

	/**
	 * The newspack-plugin admin header (`WizardsAdminHeader`) renders
	 * an "Ads" tab pointing at `edit.php?post_type=newspack_nl_ads_cpt`
	 * for the wizard's ads / advertisers screens. Our React page lives
	 * at the same URL plus `&page=newspack-newsletters-ads-list`, so
	 * the wizard's strict URL equality match never fires here. Return
	 * the canonical Ads tab URL so `Admin_Shell` can flip the matching
	 * `<a>` to `.selected` after the header mounts.
	 *
	 * @return string
	 */
	public function get_wizard_tab_url() {
		return admin_url( 'edit.php?post_type=' . Ads::CPT );
	}
}

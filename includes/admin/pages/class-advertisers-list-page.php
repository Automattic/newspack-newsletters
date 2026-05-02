<?php
/**
 * Newsletter Advertisers list admin page (React DataView).
 *
 * Replaces the classic taxonomy term-management screen for the
 * Advertiser taxonomy (`newspack_nl_advertiser`) with a React
 * DataView, in both standalone and bundled modes. Mirrors the ads
 * list page — registers as a hidden submenu under the ads CPT
 * parent and 302s the legacy
 * `edit-tags.php?taxonomy=newspack_nl_advertiser` URL across.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;
use Newspack_Newsletters;
use Newspack_Newsletters\Ads;

defined( 'ABSPATH' ) || exit;

/**
 * "Advertisers" list page — registered in both modes.
 */
class Advertisers_List_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-advertisers-list';

	/**
	 * Get the page label.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'Advertisers', 'newspack-newsletters' );
	}

	/**
	 * Register under the parent WP resolves to at access-check time.
	 * Mirrors `Ads_List_Page::get_parent_slug` — top-level when the
	 * ads CPT is its own menu, under the newsletters CPT otherwise.
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
	 * The visible click target is the auto-generated taxonomy submenu
	 * `edit-tags.php?taxonomy=newspack_nl_advertiser` (in standalone) or
	 * the wizard's "Advertisers" tab (in bundled, where
	 * `Newsletters_Wizard::registered_taxonomy_advertiser` flips
	 * `show_in_menu` off). Either way our React page lives behind a
	 * redirect, not a separate sidebar entry.
	 *
	 * @return bool
	 */
	public function is_hidden_from_menu() {
		return true;
	}

	/**
	 * Active top-level menu while the advertisers list is rendered.
	 * Same dynamic placement as the ads list — top-level ads CPT or the
	 * newsletters CPT depending on `display_ads_menu_item_separately()`.
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
	 * Submenu entry to highlight while the advertisers list is rendered.
	 *
	 * Points at the auto-generated taxonomy submenu so the sidebar entry
	 * remains active in standalone mode. In bundled mode the submenu is
	 * hidden by `Newsletters_Wizard::registered_taxonomy_advertiser` and
	 * the dark Newspack chrome takes over the active-tab indication via
	 * `get_wizard_tab_url()` — a no-op highlight here is fine.
	 *
	 * @return string
	 */
	public function get_submenu_file() {
		return 'edit-tags.php?taxonomy=' . Ads::ADVERTISER_TAX . '&post_type=' . Ads::CPT;
	}

	/**
	 * Classic taxonomy term-management screen the React page shadows.
	 * `edit-tags.php?taxonomy=X` resolves to `WP_Screen::id = 'edit-X'`.
	 *
	 * @return string
	 */
	public function get_legacy_screen_id() {
		return 'edit-' . Ads::ADVERTISER_TAX;
	}

	/**
	 * Build the redirect URL for the legacy advertisers term-management
	 * screen. Same shape as the ads list redirect — the React page lives
	 * at `edit.php?post_type=newspack_nl_ads_cpt&page=<slug>` regardless
	 * of which taxonomy URL the user came from.
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

	/**
	 * The newspack-plugin admin header (`WizardsAdminHeader`) renders an
	 * "Advertisers" tab pointing at the legacy taxonomy URL for the
	 * wizard's ads / advertisers screens. Our React page lives at the
	 * ads CPT URL plus `&page=newspack-newsletters-advertisers-list`, so
	 * the wizard's strict URL equality match never fires here. Return
	 * the canonical Advertisers tab URL so `Admin_Shell` can flip the
	 * matching `<a>` to `.selected` after the header mounts.
	 *
	 * @return string
	 */
	public function get_wizard_tab_url() {
		return admin_url( 'edit-tags.php?taxonomy=' . Ads::ADVERTISER_TAX . '&post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT );
	}
}

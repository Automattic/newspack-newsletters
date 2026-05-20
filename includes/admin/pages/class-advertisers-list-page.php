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

use Newspack_Newsletters;
use Newspack_Newsletters\Ads;

defined( 'ABSPATH' ) || exit;

/**
 * "Advertisers" list page — registered in both modes.
 */
class Advertisers_List_Page extends Hidden_React_List_Page {
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
	 * Match the auto-generated taxonomy submenu URL so the sidebar entry
	 * highlights. The advertiser tax is shared with the newsletters CPT
	 * (the only one with `show_in_menu`), so submenu mode highlights
	 * under the newsletters CPT URL.
	 *
	 * @return string
	 */
	public function get_submenu_file() {
		if ( Ads::display_ads_menu_item_separately() ) {
			return 'edit-tags.php?taxonomy=' . Ads::ADVERTISER_TAX . '&amp;post_type=' . Ads::CPT;
		}
		return 'edit-tags.php?taxonomy=' . Ads::ADVERTISER_TAX . '&amp;post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
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
	 * Post type the React page lives under in the admin URL — the ads
	 * CPT, regardless of which taxonomy URL the user came from.
	 *
	 * @return string
	 */
	public function get_redirect_post_type() {
		return Ads::CPT;
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

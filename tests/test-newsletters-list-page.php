<?php
/**
 * Class Test Newsletters List Page
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Admin\Pages\Newsletters_List_Page;

/**
 * Page-class metadata for the React list view.
 */
class Newsletters_List_Page_Test extends WP_UnitTestCase {
	/**
	 * Slug matches the chassis screen registry and the URL the menu link uses.
	 */
	public function test_slug_is_newspack_newsletters_list() {
		$page = new Newsletters_List_Page();
		$this->assertSame( 'newspack-newsletters-list', $page->get_slug() );
	}

	/**
	 * Label is the (translatable) "All Newsletters" string — the same label
	 * the auto-generated CPT submenu used, so the menu position is visually
	 * unchanged after the replacement.
	 */
	public function test_label_is_all_newsletters() {
		$page = new Newsletters_List_Page();
		$this->assertSame( 'All Newsletters', $page->get_label() );
	}

	/**
	 * Capability inherits the chassis default — anyone who could see the
	 * classic CPT list still sees the React replacement.
	 */
	public function test_capability_defaults_to_edit_posts() {
		$page = new Newsletters_List_Page();
		$this->assertSame( 'edit_posts', $page->get_capability() );
	}

	/**
	 * Mount id is derived from the slug so the JS shell can resolve it from
	 * the localised global without extra config.
	 */
	public function test_mount_id_matches_slug() {
		$page = new Newsletters_List_Page();
		$this->assertSame( 'newspack-newsletters-list-root', $page->get_mount_id() );
	}

	/**
	 * The list page is hidden — its visible click target is the
	 * auto-generated CPT submenu, redirected by `Admin_Shell::
	 * maybe_redirect_legacy_list`. Settings must remain visible (see
	 * `Settings_Page` for the sibling test).
	 */
	public function test_parent_slug_is_null_so_the_page_is_hidden_from_the_menu() {
		$page = new Newsletters_List_Page();
		$this->assertNull( $page->get_parent_slug() );
	}
}

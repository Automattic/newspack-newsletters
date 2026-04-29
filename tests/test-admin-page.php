<?php
/**
 * Class Test Admin Page
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Admin\Pages\Settings_Page;

/**
 * Admin Page base class behaviour.
 */
class Admin_Page_Test extends WP_UnitTestCase {
	/**
	 * Tear down.
	 */
	public function tear_down() {
		unset( $_GET['page'] );
		parent::tear_down();
	}

	/**
	 * Returns true when ?page= matches the slug.
	 */
	public function test_is_admin_page_matches_slug() {
		$page         = new Settings_Page();
		$_GET['page'] = $page->get_slug();
		$this->assertTrue( $page->is_admin_page() );
	}

	/**
	 * Returns false when ?page= is a different slug.
	 */
	public function test_is_admin_page_does_not_match_other_slug() {
		$page         = new Settings_Page();
		$_GET['page'] = 'something-else';
		$this->assertFalse( $page->is_admin_page() );
	}

	/**
	 * Returns false when ?page= is absent.
	 */
	public function test_is_admin_page_handles_missing_param() {
		$page = new Settings_Page();
		unset( $_GET['page'] );
		$this->assertFalse( $page->is_admin_page() );
	}
}

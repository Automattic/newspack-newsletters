<?php
/**
 * Class Test Admin Shell
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Admin\Admin_Shell;

/**
 * Admin Shell Test.
 */
class Admin_Shell_Test extends WP_UnitTestCase {
	/**
	 * Tear down.
	 */
	public function tear_down() {
		remove_all_filters( 'newspack_newsletters_admin_bundled_mode' );
		parent::tear_down();
	}

	/**
	 * Without newspack-plugin loaded, the shell defaults to standalone mode.
	 */
	public function test_is_bundled_mode_defaults_to_false() {
		$this->assertFalse( Admin_Shell::is_bundled_mode() );
	}

	/**
	 * The detection is filterable so sites can override it explicitly.
	 */
	public function test_is_bundled_mode_filter_can_force_true() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_true' );
		$this->assertTrue( Admin_Shell::is_bundled_mode() );
	}

	/**
	 * Filter overrides class-existence detection.
	 */
	public function test_is_bundled_mode_filter_can_force_false() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_false' );
		$this->assertFalse( Admin_Shell::is_bundled_mode() );
	}

	/**
	 * Standalone mode exposes the Settings page only — other surfaces are
	 * added by NEWS-1928 to NEWS-1930 alongside their own features.
	 */
	public function test_get_pages_returns_settings_in_standalone_mode() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_false' );
		$slugs = array_map(
			function ( $page ) {
				return $page->get_slug();
			},
			Admin_Shell::get_pages()
		);
		$this->assertSame( [ 'newspack-newsletters-settings' ], $slugs );
	}

	/**
	 * Bundled mode defers entirely to newspack-plugin's Engagement > Newsletters
	 * surface, so the chassis registers no pages.
	 */
	public function test_get_pages_is_empty_in_bundled_mode() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_true' );
		$this->assertSame( [], Admin_Shell::get_pages() );
	}
}

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
	 * Default detection: when the Newspack core class exists, bundled mode is true;
	 * the filter can still override either way.
	 *
	 * Runs in a separate PHPUnit process so the `class_alias` to `\Newspack\Newspack`
	 * does not leak into other tests' default detection.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_is_bundled_mode_default_detection() {
		if ( ! class_exists( '\Newspack\Newspack' ) ) {
			class_alias( '\stdClass', '\Newspack\Newspack' );
		}

		// With the class present and no filter, default detection is true.
		$this->assertTrue( Admin_Shell::is_bundled_mode() );

		// Filter overrides the true default.
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_false' );
		$this->assertFalse( Admin_Shell::is_bundled_mode() );
	}

	/**
	 * The filter contract: forcing true returns true regardless of class state.
	 */
	public function test_is_bundled_mode_filter_can_force_true() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_true' );
		$this->assertTrue( Admin_Shell::is_bundled_mode() );
	}

	/**
	 * The filter contract: forcing false returns false regardless of class state.
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

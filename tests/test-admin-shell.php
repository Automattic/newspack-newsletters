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
	 * Standalone mode exposes the list view alongside Settings; other React
	 * surfaces are added by NEWS-1929 / NEWS-1930 alongside their own features.
	 */
	public function test_get_pages_in_standalone_mode_includes_list_and_settings() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_false' );
		$slugs = array_map(
			function ( $page ) {
				return $page->get_slug();
			},
			Admin_Shell::get_pages()
		);
		$this->assertSame( [ 'newspack-newsletters-list', 'newspack-newsletters-settings' ], $slugs );
	}

	/**
	 * Bundled mode defers Settings to newspack-plugin's Engagement > Newsletters
	 * surface — but the React list view replaces the CPT list in both modes.
	 */
	public function test_get_pages_in_bundled_mode_includes_list_only() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_true' );
		$slugs = array_map(
			function ( $page ) {
				return $page->get_slug();
			},
			Admin_Shell::get_pages()
		);
		$this->assertSame( [ 'newspack-newsletters-list' ], $slugs );
	}

	/**
	 * The redirect target points at our React page slug under the CPT's parent.
	 * Returning the URL (rather than performing the redirect) keeps the test
	 * isolated from `wp_safe_redirect`'s exit behaviour.
	 */
	public function test_legacy_list_url_redirects_to_react_page() {
		$expected = admin_url( 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '&page=newspack-newsletters-list' );
		$this->assertSame( $expected, Admin_Shell::get_legacy_redirect_target() );
	}
}

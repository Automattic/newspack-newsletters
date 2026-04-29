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
		$target = Admin_Shell::get_legacy_redirect_target();
		$this->assertStringContainsString( 'edit.php?', $target );
		$this->assertStringContainsString( 'post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT, $target );
		$this->assertStringContainsString( 'page=newspack-newsletters-list', $target );
		$this->assertStringNotContainsString( 'post_status', $target );
	}

	/**
	 * Deep links like `?post_type=newspack_nl_cpt&post_status=trash` forward
	 * the `post_status` value onto the React page so the JS side can
	 * pre-fill its filter (see `getInitialView`). String form retained for
	 * back-compat with the original signature.
	 */
	public function test_legacy_redirect_forwards_post_status() {
		$target = Admin_Shell::get_legacy_redirect_target( 'trash' );
		$this->assertStringContainsString( 'post_status=trash', $target );
		$this->assertStringContainsString( 'page=newspack-newsletters-list', $target );
	}

	/**
	 * Search and sort are forwarded too so deep links to filtered/sorted
	 * legacy URLs (`?s=…&orderby=title&order=asc`) land on the React page
	 * with equivalent view state — Copilot review #2095.
	 */
	public function test_legacy_redirect_forwards_search_and_sort() {
		$target = Admin_Shell::get_legacy_redirect_target(
			[
				's'       => 'weeklydigest',
				'orderby' => 'title',
				'order'   => 'asc',
			]
		);
		$this->assertStringContainsString( 's=weeklydigest', $target );
		$this->assertStringContainsString( 'orderby=title', $target );
		$this->assertStringContainsString( 'order=asc', $target );
	}

	/**
	 * `paged` is deliberately NOT forwarded — legacy WP_List_Table uses
	 * 20 items per page while the DataView uses 25, so the page number
	 * doesn't translate cleanly. The redirect drops it on the floor.
	 */
	public function test_legacy_redirect_drops_paged() {
		$target = Admin_Shell::get_legacy_redirect_target( [ 'paged' => '3' ] );
		$this->assertStringNotContainsString( 'paged=3', $target );
	}

	/**
	 * Settings is registered with the CPT as parent so it appears as a
	 * visible submenu in standalone mode. Regression: the previous shape
	 * passed `null` for every page, which silently hid Settings.
	 */
	public function test_settings_page_parent_is_the_cpt_so_it_is_visible_in_the_menu() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_false' );
		$pages = Admin_Shell::get_pages();
		$settings = null;
		foreach ( $pages as $page ) {
			if ( 'newspack-newsletters-settings' === $page->get_slug() ) {
				$settings = $page;
			}
		}
		$this->assertNotNull( $settings );
		$this->assertSame(
			'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			$settings->get_parent_slug()
		);
	}

	/**
	 * On a chassis-managed page, the parent_file filter forces the Newsletters
	 * CPT to be the active top-level menu so the sidebar highlights correctly.
	 */
	public function test_highlight_parent_menu_returns_cpt_url_when_on_a_managed_page() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_true' );
		$_GET['page'] = 'newspack-newsletters-list';

		$expected = 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		$this->assertSame( $expected, Admin_Shell::highlight_parent_menu( 'unrelated.php' ) );

		unset( $_GET['page'] );
	}

	/**
	 * Off-page calls pass through unchanged.
	 */
	public function test_highlight_parent_menu_passes_through_off_page() {
		unset( $_GET['page'] );
		$this->assertSame( 'unrelated.php', Admin_Shell::highlight_parent_menu( 'unrelated.php' ) );
	}

	/**
	 * The list page maps onto the auto-generated "All Newsletters" submenu so
	 * WP's sidebar highlights it instead of leaving every entry inactive.
	 */
	public function test_highlight_submenu_targets_all_newsletters_for_list_page() {
		add_filter( 'newspack_newsletters_admin_bundled_mode', '__return_true' );
		$_GET['page'] = 'newspack-newsletters-list';

		$expected = 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		$this->assertSame( $expected, Admin_Shell::highlight_submenu( 'unrelated' ) );

		unset( $_GET['page'] );
	}
}

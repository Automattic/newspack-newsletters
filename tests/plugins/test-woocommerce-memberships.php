<?php
/**
 * Class Newsletters Test Woocommerce Memberships.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack_Newsletters\Plugins;

/**
 * Test Woocommerce Memeberships.
 */
class Woocommerce_Memberships_Test extends \WP_UnitTestCase {
	public function test_is_membership_list() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$this->assertTrue( Woocommerce_Memberships::is_membership_list( 1 ) );
		$this->assertFalse( Woocommerce_Memberships::is_membership_list( 0 ) );
	}
}

<?php // phpcs:ignoreFile
/**
 * Class Newsletters Test Woocommerce Memberships.
 *
 * @package Newspack_Newsletters
 */

use Newspack_Newsletters\Plugins\Woocommerce_Memberships;
use Newspack\Newsletters\Subscription_Lists;

/**
 * Test Woocommerce Memberships.
 */
class Woocommerce_Memberships_Test extends \WP_UnitTestCase {
	public static $subscription_list_id = 1;

	public static function setup_membership_plans() {
		$membership_plan_rule = new WC_Memberships_Membership_Plan_Rule(
			[
				'content_type_name' => Subscription_Lists::CPT,
				'object_id_rules'   => [ self::$subscription_list_id ],
			]
		);

		$membership_plan = new WC_Memberships_Membership_Plan( 1234 );
		$membership_plan->set_content_restriction_rules( [ $membership_plan_rule ] );

		return [ $membership_plan ];
	}

	public function test_is_subscription_list_tied_to_plan() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$subscription_list_tied_to_plan = Woocommerce_Memberships::is_subscription_list_tied_to_plan( self::$subscription_list_id );
		$this->assertTrue( $subscription_list_tied_to_plan );

		$subscription_list_not_tied_to_plan = Woocommerce_Memberships::is_subscription_list_tied_to_plan( 0 );
		$this->assertFalse( $subscription_list_not_tied_to_plan );
	}
}

/**
 * Mock wc_memberships_get_membership_plans.
 *
 * @return array
 */
function wc_memberships_get_membership_plans() {
	return Woocommerce_Memberships_Test::setup_membership_plans();
}

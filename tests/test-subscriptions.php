<?php
/**
 * Class Newsletters Test Subscriptions
 *
 * @package Newspack_Newsletters
 */

/**
 * Tests various Subscriptions methods
 */
class Subscriptions_Test extends WP_UnitTestCase {
	/**
	 * Test set up.
	 */
	public static function set_up_before_class() {
		// Set an ESP.
		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
		update_option( 'newspack_mailchimp_api_key', 'test-us1' );
	}

	/**
	 * Add a contact to a single list.
	 */
	public function test_get_contact_data() {
		$result = Newspack_Newsletters_Subscription::get_contact_data( 'not-there@example.com' );
		$this->assertTrue( is_wp_error( $result ), 'Should return WP_Error if no contact is found.' );

		$result = Newspack_Newsletters_Subscription::get_contact_data( 'test1@example.com' );
		$this->assertEquals(
			[
				'lists'         => [
					'test-list' => [
						'id'         => 123,
						'contact_id' => 123,
						'status'     => 'subscribed',
					],
				],
				'tags'          => [],
				'interests'     => [],
				'full_name'     => 'Test User',
				'email_address' => 'test1@example.com',
				'id'            => 123,
			],
			$result
		);
	}
}

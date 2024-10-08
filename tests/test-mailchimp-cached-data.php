<?php
/**
 * Class Newsletters Test Mailchimp Cached Data
 *
 * @package Newspack_Newsletters
 */

/**
 * Tests the Mailchimp Cached Data Class.
 */
class Newsletters_Mailchimp_Cached_Data_Test extends WP_UnitTestCase {
	/**
	 * Setup.
	 */
	public function set_up() {
		// Reset the API key.
		delete_option( 'newspack_mailchimp_api_key' );
	}

	/**
	 * Test the API setup.
	 */
	public function test_mailchimp_cached_data_api_setup() {
		// This tests if an empty API key won't cause the code to error out.
		$segments = Newspack_Newsletters_Mailchimp_Cached_Data::fetch_segments( 'list1' );
		$this->assertEquals( [], $segments );
	}
}

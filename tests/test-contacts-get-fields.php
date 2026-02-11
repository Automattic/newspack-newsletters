<?php // phpcs:ignore WordPress.Files.FileName.InvalidClassFileName
/**
 * Class Test Contacts Get Fields
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Subscription_Lists;

/**
 * Tests the Newspack_Newsletters_Contacts::get_fields() method.
 */
class Newspack_Newsletters_Contacts_Get_Fields_Test extends WP_UnitTestCase {

	/**
	 * Tear down.
	 */
	public function tear_down() {
		delete_option( 'newspack_mailchimp_api_key' );
		delete_option( 'newspack_newsletters_active_campaign_url' );
		delete_option( 'newspack_newsletters_active_campaign_key' );
		wp_cache_delete( 'active_campaign_contact_fields' );
		Newspack_Newsletters::set_service_provider( null );
	}

	/**
	 * Test get_fields returns WP_Error when provider is not set.
	 */
	public function test_get_fields_without_provider() {
		Newspack_Newsletters::set_service_provider( null );
		$result = Newspack_Newsletters_Contacts::get_fields();
		$this->assertTrue( is_wp_error( $result ) );
		$this->assertEquals( 'newspack_newsletters_invalid_provider', $result->get_error_code() );
	}

	/**
	 * Test Mailchimp get_contact_fields requires list_id.
	 */
	public function test_mailchimp_get_fields_requires_list_id() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );
		update_option( 'newspack_mailchimp_api_key', 'test-us1' );
		$result = Newspack_Newsletters_Contacts::get_fields();
		$this->assertTrue( is_wp_error( $result ) );
		$this->assertEquals( 'newspack_mailchimp_get_contact_fields_failed', $result->get_error_code() );
	}

	/**
	 * Test Mailchimp get_contact_fields with valid list_id.
	 */
	public function test_mailchimp_get_fields_with_list_id() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );
		update_option( 'newspack_mailchimp_api_key', 'test-us1' );
		// Pre-populate the Mailchimp cache with merge fields data.
		update_option(
			'newspack_nl_mailchimp_cache_test-list',
			[
				'merge_fields' => [
					[
						'tag'  => 'EMAIL',
						'name' => 'Email Address',
						'type' => 'email',
					],
					[
						'tag'  => 'FNAME',
						'name' => 'First Name',
						'type' => 'text',
					],
					[
						'tag'  => 'LNAME',
						'name' => 'Last Name',
						'type' => 'text',
					],
				],
			]
		);
		$result = Newspack_Newsletters_Contacts::get_fields( 'test-list' );
		$this->assertFalse( is_wp_error( $result ) );
		$this->assertIsArray( $result );
		$this->assertCount( 3, $result );
		$this->assertEquals( 'Email Address', $result[0]['key'] );
		$this->assertEquals( 'First Name', $result[1]['key'] );
		$this->assertEquals( 'Last Name', $result[2]['key'] );
		// Clean up.
		delete_option( 'newspack_nl_mailchimp_cache_test-list' );
	}

	/**
	 * Test ActiveCampaign get_contact_fields uses caching.
	 */
	public function test_active_campaign_get_fields_caching() {
		Newspack_Newsletters::set_service_provider( 'active_campaign' );
		update_option( 'newspack_newsletters_active_campaign_url', 'https://test.api-us1.com' );
		update_option( 'newspack_newsletters_active_campaign_key', 'test-key' );
		// Mock the ActiveCampaign API response.
		add_filter( 'pre_http_request', [ $this, 'mock_active_campaign_fields_response' ], 10, 3 );
		// First call should hit the API.
		$result1 = Newspack_Newsletters_Contacts::get_fields();
		$this->assertFalse( is_wp_error( $result1 ) );
		$this->assertIsArray( $result1 );
		$this->assertCount( 2, $result1 );
		$this->assertEquals( 'First Name', $result1[0]['key'] );
		$this->assertEquals( 'Last Name', $result1[1]['key'] );
		// Remove filter to ensure second call uses cache.
		remove_filter( 'pre_http_request', [ $this, 'mock_active_campaign_fields_response' ] );
		// Second call should use cached data.
		$result2 = Newspack_Newsletters_Contacts::get_fields();
		$this->assertFalse( is_wp_error( $result2 ) );
		$this->assertEquals( $result1, $result2 );
	}

	/**
	 * Test ActiveCampaign get_contact_fields returns WP_Error on API failure.
	 */
	public function test_active_campaign_get_fields_error() {
		Newspack_Newsletters::set_service_provider( 'active_campaign' );
		update_option( 'newspack_newsletters_active_campaign_url', 'https://test.api-us1.com' );
		update_option( 'newspack_newsletters_active_campaign_key', 'test-key' );
		// Mock a failed API response.
		add_filter( 'pre_http_request', [ $this, 'mock_active_campaign_error_response' ], 10, 3 );
		$result = Newspack_Newsletters_Contacts::get_fields();
		remove_filter( 'pre_http_request', [ $this, 'mock_active_campaign_error_response' ] );
		$this->assertTrue( is_wp_error( $result ) );
	}

	/**
	 * Mock ActiveCampaign successful fields response.
	 *
	 * @param mixed  $response The response.
	 * @param array  $parsed_args The parsed arguments.
	 * @param string $url The URL.
	 * @return array|mixed
	 */
	public function mock_active_campaign_fields_response( $response, $parsed_args, $url ) {
		// Match the ActiveCampaign fields endpoint.
		if ( strpos( $url, '/api/3/fields' ) !== false ) {
			return [
				'response' => [
					'code'    => 200,
					'message' => 'OK',
				],
				'body'     => wp_json_encode(
					[
						'fields' => [
							[
								'id'    => '1',
								'title' => 'First Name',
								'type'  => 'text',
							],
							[
								'id'    => '2',
								'title' => 'Last Name',
								'type'  => 'text',
							],
						],
						'meta'   => [
							'total' => 2,
						],
					]
				),
			];
		}
		return $response;
	}

	/**
	 * Mock ActiveCampaign error response.
	 *
	 * @param mixed  $response The response.
	 * @param array  $parsed_args The parsed arguments.
	 * @param string $url The URL.
	 * @return array
	 */
	public function mock_active_campaign_error_response( $response, $parsed_args, $url ) {
		if ( strpos( $url, '/api/3/fields' ) !== false ) {
			return [
				'response' => [
					'code'    => 401,
					'message' => 'Unauthorized',
				],
				'body'     => null,
			];
		}
		return $response;
	}
}

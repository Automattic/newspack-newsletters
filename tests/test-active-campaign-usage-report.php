<?php

use PHPUnit\Framework\TestCase;

class ActiveCampaignUsageReportsTest extends TestCase {

	/**
	 * Test get_contacts_data method
	 */
	public function test_get_contacts_data() {
		$mock_subscribed_data   = [
			'meta'     => [ 'total' => 1 ],
			'contacts' => [
				[
					'id'    => 2,
					'email' => 'test2@example.com',
					'udate' => null,
					'cdate' => gmdate( 'Y-m-d H:i:s', strtotime( '-1 day' ) ),
				],
			],
		];
		$mock_unsubscribed_data = [
			'meta'     => [ 'total' => 1 ],
			'contacts' => [
				[
					'id'    => 1,
					'email' => 'test1@example.com',
					'udate' => gmdate( 'Y-m-d H:i:s', strtotime( '-1 day' ) ),
					'cdate' => gmdate( 'Y-m-d H:i:s', strtotime( '-2 day' ) ),
				],
			],
		];

		$mock_report_data = [
			gmdate( 'Y-m-d', strtotime( '-1 day' ) ) => [
				'subs'   => 1,
				'unsubs' => 1,
			],
			gmdate( 'Y-m-d', strtotime( '-2 day' ) ) => [
				'subs'   => 1,
				'unsubs' => 0,
			],
		];

		// Mock the get_all_contacts method to return the mock data
		$mock = $this->createMock( 'Newspack_Newsletters_Active_Campaign_Usage_Reports' );
		$mock->method( 'update_report_with_contact_data' )
		->willReturn( $mock_report_data );

		$mock->method( 'get_all_contacts' )
		->willReturnOnConsecutiveCalls( $mock_subscribed_data, $mock_unsubscribed_data );

		$mock_usage_reports = $mock::getInstance();
		$mock_usage_reports->setMock( $mock );

		$mock->method( 'get_all_contacts' )
			->will( $this->onConsecutiveCalls( $mock_subscribed_data, $mock_unsubscribed_data ) );

		$mock->method( 'update_report_with_contact_data' )
			->willReturn( $mock_report_data );

		$result = $mock->get_contacts_data( 2 );

		$this->assertEquals( $mock_report_data, $result );
	}

	// /**
	// * Test get_campaign_data method
	// */
	// public function test_get_campaign_data() {
	// Assuming you have a way to mock the data returned by api_v3_request
	// You should replace this with your actual mock data
	// $mock_campaigns_result = [];

	// Mock the api_v3_request method to return the mock data
	// $mock = $this->getMockBuilder( 'ActiveCampaignUsageReports' )
	// ->setMethods( [ 'api_v3_request' ] )
	// ->getMock();

	// $mock->method( 'api_v3_request' )
	// ->willReturn( $mock_campaigns_result );

	// $result = $mock->get_campaign_data( 2 );

	// You should replace this with the expected result based on your mock data
	// $expected_result = [];

	// $this->assertEquals( $expected_result, $result );
	// }
}

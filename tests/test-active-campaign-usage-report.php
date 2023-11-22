<?php // phpcs:ignore WordPress.Files.FileName.InvalidClassFileName
// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound
/**
 * Class Newsletters Test ActiveCampaign Usage Reports
 *
 * @package Newspack_Newsletters
 */

/**
 * Mock AC API.
 */
class Newspack_Newsletters_Active_Campaign_Test_Wrapper {
	public function api_v3_request( $endpoint ) { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$response = [ 'meta' => [] ];
		switch ( $endpoint ) {
			case 'contacts':
				$response['meta']['total'] = 3;
				$response['contacts']      = [
					[
						'id'    => 1,
						'email' => 'alice@mail.com',
						'cdate' => '2023-01-01 00:00:00',
						'udate' => gmdate( 'Y-m-d H:i:s', strtotime( '-1 day' ) ),
					],
					[
						'id'    => 2,
						'email' => 'jane@mail.com',
						'cdate' => gmdate( 'Y-m-d H:i:s', strtotime( '-1 day' ) ),
						'udate' => null,
					],
					[
						'id'    => 3,
						'email' => 'bob@mail.com',
						'cdate' => '2023-01-01 00:00:00',
						'udate' => '2023-02-01 00:00:00',
					],
				];
				break;
			case 'campaigns':
				$response['meta']['total'] = 1;
				$response['campaigns']     = [
					[
						'id'               => 1,
						'status'           => 5,
						'sdate'            => gmdate( 'Y-m-d H:i:s', strtotime( '-1 day' ) ),
						'send_amt'         => 10,
						'uniqueopens'      => 5,
						'uniquelinkclicks' => 2,
					],
					[
						'id'               => 2,
						'status'           => 5,
						'sdate'            => gmdate( 'Y-m-d H:i:s', strtotime( '-1 day' ) ),
						'send_amt'         => 5,
						'uniqueopens'      => 3,
						'uniquelinkclicks' => 1,
					],
					[
						'id'               => 3,
						'status'           => 5,
						'sdate'            => gmdate( 'Y-m-d H:i:s', strtotime( '-3 day' ) ),
						'send_amt'         => 100,
						'uniqueopens'      => 40,
						'uniquelinkclicks' => 10,
					],
				];
				break;
		}
		return $response;
	}
}

/**
 * Test ActiveCampaign Usage Reports.
 */
class ActiveCampaignUsageReportsTest extends WP_UnitTestCase {
	public function test_get_usage_report() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$expected_report               = new Newspack_Newsletters_Service_Provider_Usage_Report();
		$expected_report->emails_sent  = 15;
		$expected_report->opens        = 8;
		$expected_report->clicks       = 3;
		$expected_report->subscribes   = 1;
		$expected_report->unsubscribes = 1;

		$actual_report = ( new Newspack_Newsletters_Active_Campaign_Usage_Reports( new Newspack_Newsletters_Active_Campaign_Test_Wrapper() ) )->get_usage_report();

		$this->assertEquals( $expected_report->to_array(), $actual_report->to_array() );
	}

	public function test_get_usage_report_with_prior_data() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		update_option(
			Newspack_Newsletters_Active_Campaign_Usage_Reports::LAST_REPORT_OPTION_NAME,
			[
				'emails_sent' => 10,
				'opens'       => 5,
				'clicks'      => 2,
			]
		);
		$expected_report               = new Newspack_Newsletters_Service_Provider_Usage_Report();
		$expected_report->emails_sent  = 5;
		$expected_report->opens        = 3;
		$expected_report->clicks       = 1;
		$expected_report->subscribes   = 1;
		$expected_report->unsubscribes = 1;

		$actual_report = ( new Newspack_Newsletters_Active_Campaign_Usage_Reports( new Newspack_Newsletters_Active_Campaign_Test_Wrapper() ) )->get_usage_report();

		$this->assertEquals( $expected_report->to_array(), $actual_report->to_array() );
	}
}
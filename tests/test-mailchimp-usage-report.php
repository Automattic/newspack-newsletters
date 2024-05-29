<?php // phpcs:ignore WordPress.Files.FileName.InvalidClassFileName
// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound
/**
 * Class Newsletters Test Mailchimp Usage Reports
 *
 * @package Newspack_Newsletters
 */

/**
 * Test Mailchimp Usage Reports.
 */
class MailchimpUsageReportsTest extends WP_UnitTestCase {
	public function test_get_usage_report_mailchimp() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$expected_report = new Newspack_Newsletters_Service_Provider_Usage_Report(
			[

				'emails_sent'    => 1,
				'opens'          => 1,
				'clicks'         => 1,
				'subscribes'     => 1,
				'unsubscribes'   => 1,
				'total_contacts' => 42,
			]
		);

		$actual_report = ( new Newspack_Newsletters_Mailchimp_Usage_Reports() )->get_usage_report();

		$this->assertEquals( $expected_report->to_array(), $actual_report->to_array() );
	}

	public function test_get_usage_report_mailchimp_past() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$expected_report_yesterday = new Newspack_Newsletters_Service_Provider_Usage_Report(
			[
				'emails_sent'    => 1,
				'opens'          => 1,
				'clicks'         => 1,
				'subscribes'     => 1,
				'unsubscribes'   => 1,
				'total_contacts' => 42,
			]
		);
		$expected_report_day_before_yesterday = new Newspack_Newsletters_Service_Provider_Usage_Report(
			[
				'emails_sent'    => 2,
				'opens'          => 2,
				'clicks'         => 2,
				'subscribes'     => 2,
				'unsubscribes'   => 2,
				'total_contacts' => 42,
			]
		);
		$expected_report_day_before_yesterday->set_date( gmdate( 'Y-m-d', strtotime( '-2 day' ) ) );

		$actual_reports = ( new Newspack_Newsletters_Mailchimp_Usage_Reports() )->get_past_usage_reports( 2 );

		$this->assertEquals( $expected_report_yesterday->to_array(), $actual_reports[0]->to_array() );
		$this->assertEquals( $expected_report_day_before_yesterday->to_array(), $actual_reports[1]->to_array() );
	}

	public function test_get_usage_report_mailchimp_past_serialized() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$results = ( new Newspack_Newsletters_Mailchimp_Usage_Reports() )->get_past_usage_reports( 2, true );
		$this->assertEquals(
			[
				[
					'date'           => gmdate( 'Y-m-d', strtotime( '-1 day' ) ),
					'emails_sent'    => 1,
					'opens'          => 1,
					'clicks'         => 1,
					'subscribes'     => 1,
					'unsubscribes'   => 1,
					'total_contacts' => 42,
					'growth_rate'    => 0.0,
				],
				[
					'date'           => gmdate( 'Y-m-d', strtotime( '-2 day' ) ),
					'emails_sent'    => 2,
					'opens'          => 2,
					'clicks'         => 2,
					'subscribes'     => 2,
					'unsubscribes'   => 2,
					'total_contacts' => 42,
					'growth_rate'    => 0.0,
				],
			],
			$results
		);
	}
}

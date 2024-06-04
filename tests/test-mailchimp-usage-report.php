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
	/**
	 * Teardown.
	 */
	public function tear_down() {
		delete_option( Newspack_Newsletters_Mailchimp_Usage_Reports::REPORTS_OPTION_NAME );
	}

	public function test_get_usage_report_mailchimp_initial() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$expected_report = new Newspack_Newsletters_Service_Provider_Usage_Report(
			[

				'emails_sent'    => 12,
				'opens'          => 13,
				'clicks'         => 14,
				'subscribes'     => 1,
				'unsubscribes'   => 1,
				'total_contacts' => 42,
			]
		);

		$actual_report = ( new Newspack_Newsletters_Mailchimp_Usage_Reports() )->get_usage_report();

		$this->assertEquals( $expected_report->to_array(), $actual_report->to_array() );
	}

	public function test_get_usage_report_mailchimp_with_prior_data() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		// Saved prior results.
		$saved_campaign_reports = [
			'campaign-day-before-yesterday' => [
				'emails_sent' => 22,
				// Values "from yesterday", which will have to be subtracted from the new report's values.
				'opens'       => 10,
				'clicks'      => 10,
				'send_time'   => gmdate( 'Y-m-d\T08:00:00P', strtotime( '-7 day' ) ),
			],
		];
		update_option( Newspack_Newsletters_Mailchimp_Usage_Reports::REPORTS_OPTION_NAME, $saved_campaign_reports );

		$expected_report = new Newspack_Newsletters_Service_Provider_Usage_Report(
			[

				'emails_sent'    => 12,
				'opens'          => 13 + 23 - 10,
				'clicks'         => 14 + 24 - 10,
				'subscribes'     => 1,
				'unsubscribes'   => 1,
				'total_contacts' => 42,
			]
		);

		$actual_report = ( new Newspack_Newsletters_Mailchimp_Usage_Reports() )->get_usage_report();

		$this->assertEquals( $expected_report->to_array(), $actual_report->to_array() );
	}
}

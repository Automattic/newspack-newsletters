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
	 * Test set up.
	 */
	public static function set_up_before_class() {
		// Set an ESP.
		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
		update_option( 'newspack_mailchimp_api_key', 'test-us1' );
	}

	/**
	 * Teardown.
	 */
	public function set_up() {
		delete_option( Newspack_Newsletters_Mailchimp_Usage_Reports::REPORTS_OPTION_NAME );
	}

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
				'subscribes'     => 2,
				'unsubscribes'   => 2,
				'total_contacts' => 63,
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
				'subscribes'     => 2,
				'unsubscribes'   => 2,
				'total_contacts' => 63,
			]
		);

		$actual_report = ( new Newspack_Newsletters_Mailchimp_Usage_Reports() )->get_usage_report();

		$this->assertEquals( $expected_report->to_array(), $actual_report->to_array() );
	}

	public function test_get_usage_report_mailchimp_backfill() { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		$actual_reports = ( new Newspack_Newsletters_Mailchimp_Usage_Reports() )->get_usage_reports( 10 );
		$this->assertCount( 10, $actual_reports );
		$serialized_actual_reports = array_map(
			function( $report ) {
				return $report->to_array();
			},
			$actual_reports
		);
		$last_report = end( $serialized_actual_reports );
		$this->assertEquals( 60, $last_report['emails_sent'] );
		$this->assertEquals( 40, $last_report['opens'] );
		$this->assertEquals( 20, $last_report['clicks'] );
		// Mock API returns 1*<day index> per list, there are two mock lists and day index will be 10 here.
		$this->assertEquals( 20, $last_report['unsubscribes'] );
		$this->assertEquals( 20, $last_report['subscribes'] );
	}
}

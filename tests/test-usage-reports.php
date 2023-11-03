<?php
/**
 * Class Test Usage Reports
 *
 * @package Newspack_Newsletters
 */

/**
 * Usage Reports Test.
 */
class Newsletter_Usage_Reports_Test extends WP_UnitTestCase {
	/**
	 * Test set up.
	 */
	public function set_up() {
		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
	}

	/**
	 * Test MC usage report processing.
	 */
	public function test_mailchimp_usage_report() {
		$mailchimp_data = [
			[
				'id'       => 1,
				'activity' => [
					[
						'day'              => '2023-01-01',
						'emails_sent'      => 2,
						'unique_opens'     => 3,
						'recipient_clicks' => 4,
						'subs'             => 5,
						'unsubs'           => 6,
					],
					[
						'day'              => '2023-01-02',
						'emails_sent'      => 7,
						'unique_opens'     => 8,
						'recipient_clicks' => 9,
						'subs'             => 10,
						'unsubs'           => 11,
					],
				],
			],
			[
				'id'       => 2,
				'activity' => [
					[
						'day'              => '2023-01-01',
						'emails_sent'      => 2,
						'unique_opens'     => 3,
						'recipient_clicks' => 4,
						'subs'             => 5,
						'unsubs'           => 6,
					],
					[
						'day'              => '2023-01-03',
						'emails_sent'      => 3,
						'unique_opens'     => 3,
						'recipient_clicks' => 3,
						'subs'             => 3,
						'unsubs'           => 3,
					],
				],
			],
		];
		$result         = Newspack_Newsletters_Mailchimp_Usage_Reports::process_data_to_report( $mailchimp_data );
		$this->assertEquals(
			[
				[
					'date'        => '2023-01-01',
					'emails_sent' => 4,
					'opens'       => 6,
					'clicks'      => 8,
					'subs'        => 10,
					'unsubs'      => 12,
				],
				[
					'date'        => '2023-01-02',
					'emails_sent' => 7,
					'opens'       => 8,
					'clicks'      => 9,
					'subs'        => 10,
					'unsubs'      => 11,
				],
				[
					'date'        => '2023-01-03',
					'emails_sent' => 3,
					'opens'       => 3,
					'clicks'      => 3,
					'subs'        => 3,
					'unsubs'      => 3,
				],
			],
			$result
		);
	}
}

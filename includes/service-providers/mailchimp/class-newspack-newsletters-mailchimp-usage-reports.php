<?php
/**
 * Service Provider: Mailchimp Usage Reports
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

use DrewM\MailChimp\MailChimp;

/**
 * Usage reports for Mailchimp.
 */
class Newspack_Newsletters_Mailchimp_Usage_Reports {
	/**
	 * Retrieves the main Mailchimp instance
	 *
	 * @return Newspack_Newsletters_Mailchimp
	 */
	private static function get_mc_instance() {
		return Newspack_Newsletters_Mailchimp::instance();
	}

	/**
	 * Get usage reports for a specific timeframe.
	 *
	 * @param string $days_in_past_count How many days in the past to look for.
	 * @param bool   $return_serialized Whether to return usage report objects or serialized reports.
	 * @return Newspack_Newsletters_Service_Provider_Usage_Report[] Usage reports.
	 */
	public static function get_past_usage_reports( $days_in_past_count = 1, $return_serialized = false ) {
		$mailchimp_instance = self::get_mc_instance();
		$mc_api             = new Mailchimp( $mailchimp_instance->api_key() );

		$reports = [];
		$lists  = $mc_api->get( 'lists', [ 'count' => 1000 ] );
		$lists_activity_reports = [];

		foreach ( $lists['lists'] as &$list ) {
			// Get daily activity for each list.
			$activity_response = $mc_api->get(
				'lists/' . $list['id'] . '/activity',
				[
					'count' => $days_in_past_count + 1, // Add 1 to include the current day, which will be disregarded.
				]
			);
			$list['activity']  = $activity_response['activity'];
		}

		for ( $day_index = 1; $day_index <= $days_in_past_count; $day_index++ ) {
			$report = new Newspack_Newsletters_Service_Provider_Usage_Report();
			$report->set_date( gmdate( 'Y-m-d', strtotime( "-$day_index day" ) ) );
			$report->total_contacts += $list['stats']['member_count'];

			foreach ( $lists['lists'] as $list ) {
				$list_activity_for_day = $list['activity'][ $day_index ];
				$report->emails_sent  += $list_activity_for_day['emails_sent'];
				$report->opens        += $list_activity_for_day['unique_opens'];
				$report->clicks       += $list_activity_for_day['recipient_clicks'];
				$report->subscribes   += $list_activity_for_day['subs'];
				$report->unsubscribes += $list_activity_for_day['unsubs'];
			}
			$reports[] = $report;
		}

		if ( $return_serialized ) {
			$reports_serialized = [];
			foreach ( $reports as $report ) {
				$reports_serialized[] = $report->to_array();
			}
			return $reports_serialized;
		}

		return $reports;
	}

	/**
	 * Creates a usage report.
	 *
	 * @return Newspack_Newsletters_Service_Provider_Usage_Report Usage report.
	 */
	public static function get_usage_report() {
		$reports = self::get_past_usage_reports();
		if ( empty( $reports ) ) {
			return new Newspack_Newsletters_Service_Provider_Usage_Report();
		}
		return reset( $reports );
	}
}

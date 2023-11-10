<?php
/**
 * Service Provider: Active_Campaign Usage Reports
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Usage reports for Active_Campaign.
 */
class Newspack_Newsletters_Active_Campaign_Usage_Reports {
	/**
	 * Retrieves the main Active_Campaign instance
	 *
	 * @return Newspack_Newsletters_Active_Campaign
	 */
	private static function get_ac_instance() {
		return Newspack_Newsletters_Active_Campaign::instance();
	}

	/**
	 * Get all contacts.
	 *
	 * @param int   $status Status of contacts to get.
	 * @param date  $created_after Date after which contacts were created.
	 * @param array $contacts Array of contacts.
	 */
	private static function get_all_contacts( $status = 1, $created_after = null, $contacts = [] ) {
		$ac     = self::get_ac_instance();
		$params = [
			'query' => [
				'offset' => count( $contacts ),
				'limit'  => 100,
				'status' => $status,
			],
		];
		if ( null !== $created_after ) {
			$params['query']['filters'] = [
				'created_after' => gmdate( 'Y-m-d', $created_after ),
			];
		}
		$active_contacts_result = $ac->api_v3_request( 'contacts', 'GET', $params );
		if ( \is_wp_error( $active_contacts_result ) ) {
			return $active_contacts_result;
		}
		$total    = intval( $active_contacts_result['meta']['total'] );
		$contacts = array_map(
			function( $contact ) {
				return array_intersect_key( $contact, array_flip( [ 'cdate', 'udate', 'email', 'id' ] ) );
			},
			array_merge( $contacts, $active_contacts_result['contacts'] )
		);
		Newspack_Newsletters_Logger::log( 'Fetching all contacts with status ' . $status . ' (' . count( $contacts ) . '/' . $total . ')' );
		if ( count( $contacts ) === $total ) {
			return $contacts;
		}
		return self::get_all_contacts( $status, $created_after, $contacts );
	}

	/**
	 * Update report with contact data.
	 *
	 * @param string $param Contact parameter to check.
	 * @param string $report_key Report key to update.
	 * @param array  $all_contacts Array of all contacts.
	 * @param array  $report Report to update.
	 * @param int    $last_n_days Number of last days to get the data about.
	 */
	private static function update_report_with_contact_data( $param, $report_key, $all_contacts, $report, $last_n_days ) {
		$cutoff_datetime = strtotime( '-' . $last_n_days . ' days' );
		foreach ( $all_contacts as $contact ) {
			if ( isset( $contact[ $param ] ) ) {
				$date        = strtotime( $contact[ $param ] );
				$date_string = gmdate( 'Y-m-d', $date );
				if ( $date < $cutoff_datetime ) {
					continue;
				}
				if ( isset( $report[ $date_string ] ) ) {
					if ( isset( $report[ $date_string ][ $report_key ] ) ) {
						$report[ $date_string ][ $report_key ]++;
					} else {
						$report[ $date_string ][ $report_key ] = 1;
					}
				} else {
					$report[ $date_string ] = [
						$report_key => 1,
					];
				}
			}
		}
		return $report;
	}

	/**
	 * Get contacts data - subs and unsubs.
	 *
	 * @param int $last_n_days Number of last days to get the data about.
	 */
	private static function get_contacts_data( $last_n_days ) {
		$report = [];

		$cutoff_datetime = strtotime( '-' . $last_n_days . ' days' );

		// Subscribers, with the cutoff date – only created (subscribed) afterwards.
		$subscribed = self::get_all_contacts( 1, $cutoff_datetime );
		if ( \is_wp_error( $subscribed ) ) {
			return $subscribed;
		}
		$report = self::update_report_with_contact_data( 'cdate', 'subs', $subscribed, $report, $last_n_days );

		// Unsubscribed contacts, without the cutoff date. All have to be pulled because
		// there's no way to filter by unsubscribed date.
		$unsubscribed_contacts = self::get_all_contacts( 2 );
		if ( \is_wp_error( $unsubscribed_contacts ) ) {
			return $unsubscribed_contacts;
		}
		$report = self::update_report_with_contact_data( 'udate', 'unsubs', $unsubscribed_contacts, $report, $last_n_days );

		return $report;
	}

	/**
	 * Get campaign data - emails sent, opens, and clicks.
	 *
	 * @param int $last_n_days Number of last days to get the data about.
	 */
	private static function get_campaign_data( $last_n_days ) {
		$report = [];

		$ac               = self::get_ac_instance();
		$params           = [
			'query' => [
				'limit'  => 100, // Assuming there will be no more than 100 campaigns in the requested period (last n days).
				'orders' => [ 'sdate' => 'DESC' ],
			],
		];
		$campaigns_result = $ac->api_v3_request( 'campaigns', 'GET', $params );
		$cutoff_datetime  = strtotime( '-' . $last_n_days . ' days' );

		if ( \is_wp_error( $campaigns_result ) ) {
			return $campaigns_result;
		}
		foreach ( $campaigns_result['campaigns'] as $campaign ) {
			if ( ! isset( $campaign['sdate'] ) ) {
				continue;
			}
			// If the send date is before the cutoff date, skip.
			$campaign_send_date = strtotime( $campaign['sdate'] );
			if ( $campaign_send_date < $cutoff_datetime ) {
				break;
			}
			$report_date = gmdate( 'Y-m-d', $campaign_send_date );
			if ( isset( $report[ $report_date ] ) ) {
				$report[ $report_date ]['emails_sent'] += $campaign['send_amt'];
				$report[ $report_date ]['opens']       += $campaign['uniqueopens'];
				$report[ $report_date ]['clicks']      += $campaign['uniquelinkclicks'];
			} else {
				$report[ $report_date ] = [
					'emails_sent' => $campaign['send_amt'],
					'opens'       => $campaign['uniqueopens'],
					'clicks'      => $campaign['uniquelinkclicks'],
				];
			}
		}
		return $report;
	}

	/**
	 * Creates a usage report.
	 *
	 * @param int $last_n_days Number of days to get the report for.
	 *
	 * @return array Usage report.
	 */
	public static function get_usage_report( $last_n_days ) {
		$report = [];

		// Get contact data to retrieve subs and unsubs.
		$contacts_data = self::get_contacts_data( $last_n_days );
		if ( \is_wp_error( $contacts_data ) ) {
			return $contacts_data;
		}

		// Get campaign data to retrieve emails sent, opens, and clicks.
		$campaign_data = self::get_campaign_data( $last_n_days );
		if ( \is_wp_error( $campaign_data ) ) {
			return $campaign_data;
		}

		$all_covered_dates = array_unique( array_merge( array_keys( $contacts_data ), array_keys( $campaign_data ) ) );
		foreach ( $all_covered_dates as $date ) {
			$report[ $date ] = [
				'date'        => $date,
				'emails_sent' => isset( $campaign_data[ $date ]['emails_sent'] ) ? $campaign_data[ $date ]['emails_sent'] : 0,
				'opens'       => isset( $campaign_data[ $date ]['opens'] ) ? $campaign_data[ $date ]['opens'] : 0,
				'clicks'      => isset( $campaign_data[ $date ]['clicks'] ) ? $campaign_data[ $date ]['clicks'] : 0,
				'subs'        => isset( $contacts_data[ $date ]['subs'] ) ? $contacts_data[ $date ]['subs'] : 0,
				'unsubs'      => isset( $contacts_data[ $date ]['unsubs'] ) ? $contacts_data[ $date ]['unsubs'] : 0,
			];
		}

		return array_values( $report );
	}
}

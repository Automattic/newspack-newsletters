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
	private static function get_mc_instance() {
		return Newspack_Newsletters_Active_Campaign::instance();
	}

	/**
	 * Creates a usage report.
	 *
	 * @return array Usage report.
	 */
	public static function get_usage_report() {
		error_log( 'ac usage report ' );
		return [];
	}
}

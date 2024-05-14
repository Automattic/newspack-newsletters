<?php
/**
 * Class Newsletters Test Subscription_Attempts
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Subscription_Attempts;

/**
 * Tests the Subscription_Attempts class
 */
class Subscription_Attempts_Test extends WP_UnitTestCase {
	/**
	 * Test DB version.
	 */
	public static function test_subscription_attempts_db_version() {
		$version = get_option( Newspack_Newsletters_Subscription_Attempts::TABLE_VERSION_OPTION );
		self::assertEquals( Newspack_Newsletters_Subscription_Attempts::TABLE_VERSION, $version );
	}

	/**
	 * Test if the attempt is added to the custom table when the WP hook is called.
	 */
	public function test_subscription_attempts_add() {
		$lists = [ 'list1', 'list2' ];
		$contact = [
			'email' => 'tester@example.com',
		];
		do_action( 'newspack_newsletters_pre_add_contact', $lists, $contact );

		global $wpdb;
		$table_name = Newspack_Newsletters_Subscription_Attempts::get_table_name();
		$query = "SELECT * FROM $table_name WHERE email = '" . $contact['email'] . "'";
		$result = $wpdb->get_results( $query, ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.NotPrepared
		self::assertEquals( $contact['email'], $result[0]['email'] );
		self::assertEquals( implode( ',', $lists ), $result[0]['list_ids'] );
	}

	/**
	 * Test data cleanup.
	 */
	public function test_subscription_attempts_cleanup() {
		global $wpdb;
		$table_name = Newspack_Newsletters_Subscription_Attempts::get_table_name();
		$wpdb->insert( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$table_name,
			[
				'email'      => 'some@email.com',
				'list_ids'   => '1,2',
				// Set created time to one year ago.
				'created_at' => \strtotime( '-1 year' ),
			],
			[
				'%s',
				'%s',
				'%s',
			]
		);

		$all_entries = $wpdb->get_results( "SELECT * FROM $table_name", ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		self::assertEquals( 1, count( $all_entries ) );

		Newspack_Newsletters_Subscription_Attempts::cleanup();
		$all_entries = $wpdb->get_results( "SELECT * FROM $table_name", ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		self::assertEmpty( $all_entries );
	}
}

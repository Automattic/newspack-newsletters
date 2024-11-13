<?php // phpcs:disable WordPress.Files.FileName.InvalidClassFileName, Squiz.Commenting, Generic.Files.OneObjectStructurePerFile.MultipleFound
/**
 * Class Newsletters Test Sync_Membership_Tied_Subscribers
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Subscription_List;
use Newspack\Newsletters\Subscription_Lists;

/**
 * Tests the Subscription_List class
 */
class Sync_Membership_Tied_Subscribers_Test extends WP_UnitTestCase {
	use WC_Memberships_Setup;

	public static $users = [
		[
			'email'             => 'john@example.com',
			'membership_status' => 'wcm-active',
		],
		[
			'email'             => 'bob@example.com',
			'membership_status' => 'wcm-cancelled',
		],
	];
	public static $list_remote_ids = [
		'main' => 'group-tag1-list1',
	];

	public static function get_contact_mock_response( $response, $endpoint, $args = [] ) {
		$matching_users = array_filter(
			self::$users,
			function ( $user ) use ( $args ) {
				return $user['email'] === $args['query'];
			}
		);

		foreach ( $matching_users as $user_data ) {
			$response['exact_matches']['members'][] = [
				'id'            => '123',
				'contact_id'    => 'aaa',
				'full_name'     => 'Test Name',
				'email_address' => $user_data['email'],
				'status'        => 'subscribed',
				'list_id'       => 'list1',
			];
		}

		return $response;
	}

	public static function setup_test_memberships() {
		// Set an ESP.
		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
		update_option( 'newspack_mailchimp_api_key', 'test-us1' );

		// Create a subscription list.
		$subscription_list_post_id = wp_insert_post(
			[
				'post_title'  => 'Test Subscription List',
				'post_type'   => Subscription_Lists::CPT,
				'post_status' => 'publish',
				'meta_input'  => [
					Subscription_List::REMOTE_ID_META => self::$list_remote_ids['main'],
				],
			]
		);

		// Create a membership plan.
		$membership_plan_rule = new WC_Memberships_Membership_Plan_Rule(
			[
				'content_type_name' => Subscription_Lists::CPT,
				'object_id_rules'   => [ $subscription_list_post_id ],
			]
		);
		$membership_plan = new WC_Memberships_Membership_Plan( 1234 );
		$membership_plan->set_content_restriction_rules( [ $membership_plan_rule ] );

		// Create user memberships.
		foreach ( self::$users as $user_data ) {
			$user_id = wp_insert_user(
				[
					'user_login' => $user_data['email'],
					'user_pass'  => '123',
					'user_email' => $user_data['email'],
					'role'       => 'subscriber',
				]
			);
			$membership_id = wp_insert_post(
				[
					'post_title'  => 'Test User Membership',
					'post_type'   => 'wc_user_membership',
					'post_status' => $user_data['membership_status'],
					'post_author' => $user_id,
					'meta_input'  => [
						'_membership_plan_id' => $membership_plan->get_id(),
						'_start_date'         => current_time( 'mysql' ),
					],
				]
			);
		}

		// Setup contact in MC ESP.
		add_filter( 'mailchimp_mock_get', [ __CLASS__, 'get_contact_mock_response' ], 10, 3 );

		return [ $membership_plan ];
	}

	public function test_cli_sync_membership_tied_subscribers() {
		$expected = [
			[
				self::$users[0]['email'],
				[ self::$list_remote_ids['main'] ], // Should be added to this list.
				[], // Should not be removed from any list.
			],
			[
				self::$users[1]['email'],
				[], // Should not be added to any list.
				[ self::$list_remote_ids['main'] ], // Should be removed from this list.
			],
		];
		global $cli_sync_membership_tied_subscribers_test_results;
		add_action(
			'newspack_newsletters_update_contact_lists',
			function( $provider, $email, $lists_to_add, $lists_to_remove ) {
				global $cli_sync_membership_tied_subscribers_test_results;
				$cli_sync_membership_tied_subscribers_test_results[] = [ $email, $lists_to_add, $lists_to_remove ];
			},
			10,
			4
		);
		\Newspack_Newsletters\CLI\Sync_Membership_Tied_Subscribers::cli_sync_membership_tied_subscribers(
			[],
			[
				'live'    => true,
				'verbose' => true,
			]
		);
		$this->assertEquals( $cli_sync_membership_tied_subscribers_test_results, $expected );
	}
}

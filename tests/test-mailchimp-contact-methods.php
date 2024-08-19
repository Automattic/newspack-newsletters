<?php // phpcs:ignore WordPress.Files.FileName.InvalidClassFileName
/**
 * Class Newsletters Test Mailchimp Contact Methods
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Subscription_Lists;
use Newspack\Newsletters\Subscription_List;

/**
 * Test Mailchimp Contact Methods
 */
class MailchimpContactMethodsTest extends WP_UnitTestCase {

	/**
	 * Subscription Lists objects used in tests
	 *
	 * @var array
	 */
	public static $subscription_lists = [];

	/**
	 * Set up before class
	 */
	public static function set_up_before_class() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );
		update_option( 'newspack_mailchimp_api_key', 'test-us1' );
	}

	/**
	 * Create lists for testing
	 */
	private static function create_lists() {

		self::$subscription_lists = [
			'audience_1'               => Subscription_Lists::get_or_create_remote_list(
				[
					'id'    => 'list1',
					'title' => 'List 1',
				]
			),
			'group1_in_audience_1'     => Subscription_Lists::get_or_create_remote_list(
				[
					'id'    => Subscription_List::mailchimp_create_public_id( 'group1', 'list1' ),
					'title' => 'Group 1',
				]
			),
			'group2_in_audience_1'     => Subscription_Lists::get_or_create_remote_list(
				[
					'id'    => Subscription_List::mailchimp_create_public_id( 'group2', 'list1' ),
					'title' => 'Group 2',
				]
			),
			'tag1_in_audience_1'       => Subscription_Lists::get_or_create_remote_list(
				[
					'id'    => Subscription_List::mailchimp_create_public_id( 'tag1', 'list1', 'tag' ),
					'title' => 'Tag 1',
				]
			),
			'tag2_in_audience_1'       => Subscription_Lists::get_or_create_remote_list(
				[
					'id'    => Subscription_List::mailchimp_create_public_id( 'tag2', 'list1', 'tag' ),
					'title' => 'Tag 2',
				]
			),
			'local_list_in_audience_1' => self::create_local_list( 'local', 'list1' ),
			'audience_2'               => Subscription_Lists::get_or_create_remote_list(
				[
					'id'    => 'list2',
					'title' => 'List 2',
				]
			),
			'group_in_audience_2'      => Subscription_Lists::get_or_create_remote_list(
				[
					'id'    => Subscription_List::mailchimp_create_public_id( 'group', 'list2' ),
					'title' => 'Group',
				]
			),
			'local_list_in_audience_2' => self::create_local_list( 'local', 'list2' ),
		];
	}

	/**
	 * Tear down class
	 */
	private static function delete_lists() {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "DELETE FROM $wpdb->posts WHERE post_type = %s" , Subscription_Lists::CPT ) ); // phpcs:ignore
	}

	/**
	 * Tear down class
	 */
	public static function tear_down_after_class() {
		delete_option( 'newspack_mailchimp_api_key' );
	}

	/**
	 * Helper to create local lists for testing
	 *
	 * @param string $list_id The ID of the group to create.
	 * @param string $audience_id The ID of the audience to create the group in.
	 * @return Subscription_List
	 */
	private static function create_local_list( $list_id, $audience_id ) {
		$post = wp_insert_post(
			[
				'post_title'  => $list_id,
				'post_type'   => Subscription_Lists::CPT,
				'post_status' => 'publish',
			]
		);

		$subscription_list = new Subscription_List( $post );
		$subscription_list->set_type( 'local' );
		$subscription_list->update_current_provider_settings( $audience_id, $list_id, $list_id );

		return $subscription_list;
	}

	/**
	 * Get a reflection of a private method from the class for testing.
	 *
	 * @param string $name Method name.
	 * @return ReflectionMethod
	 */
	protected static function get_private_method( $name ) {
		$method = new ReflectionMethod( 'Newspack_Newsletters_Mailchimp', $name );
		$method->setAccessible( true );
		return $method;
	}

	/**
	 * Data provider for test_get_status_for_payload
	 *
	 * @return array
	 */
	public function get_status_payload_data() {
		return [
			'empty'              => [
				[],
				[ 'status' => 'subscribed' ],
			],
			'empty_metadata'     => [
				[
					'metadata' => [],
				],
				[ 'status' => 'subscribed' ],
			],
			'empty_status'       => [
				[
					'metadata' => [
						'status' => '',
					],
				],
				[ 'status' => 'subscribed' ],
			],
			'only_status'        => [
				[
					'metadata' => [
						'status' => 'transactional',
					],
				],
				[
					'status' => 'transactional',
				],
			],
			'only status if new' => [
				[
					'metadata' => [
						'status_if_new' => 'transactional',
					],
				],
				[
					'status_if_new' => 'transactional',
				],
			],
			'both'               => [
				[
					'metadata' => [
						'status_if_new' => 'transactional',
						'status'        => 'subscribed',
					],
				],
				[
					'status_if_new' => 'transactional',
					'status'        => 'subscribed',
				],
			],
		];
	}

	/**
	 * Test get_status_for_payload
	 *
	 * @param array $input    Input data.
	 * @param array $expected Expected output.
	 * @dataProvider get_status_payload_data
	 */
	public function test_get_status_for_payload( $input, $expected ) {
		$method = self::get_private_method( 'get_status_for_payload' );
		$service = Newspack_Newsletters_Mailchimp::instance();
		$this->assertSame( $expected, $method->invoke( $service, $input ) );
	}

	/**
	 * Data provider for test_prepare_lists_to_add_contact
	 *
	 * @return array
	 */
	public function prepare_lists_to_add_contact_data() {
		return [
			[
				[
					'audience_1',
				],
				[
					'list1' => [
						'tags'      => [],
						'interests' => [],
					],
				],
			],
			[
				[
					'audience_1',
					'audience_2',
				],
				[
					'list1' => [
						'tags'      => [],
						'interests' => [],
					],
					'list2' => [
						'tags'      => [],
						'interests' => [],
					],
				],
			],
			[
				[
					'audience_1',
					'audience_2',
					'group1_in_audience_1',
					'local_list_in_audience_2',
					'tag2_in_audience_1',
				],
				[
					'list1' => [
						'tags'      => [
							'tag2_in_audience_1',
						],
						'interests' => [
							'group1_in_audience_1',
						],
					],
					'list2' => [
						'tags'      => [],
						'interests' => [
							'local_list_in_audience_2',
						],
					],
				],
			],
			[
				[
					'audience_1',
					'group1_in_audience_1',
					'group2_in_audience_1',
					'tag1_in_audience_1',
					'tag2_in_audience_1',
					'local_list_in_audience_1',
					'audience_2',
					'group_in_audience_2',
					'local_list_in_audience_2',
				],
				[
					'list1' => [
						'tags'      => [
							'tag1_in_audience_1',
							'tag2_in_audience_1',
						],
						'interests' => [
							'group1_in_audience_1',
							'group2_in_audience_1',
							'local_list_in_audience_1',
						],
					],
					'list2' => [
						'tags'      => [],
						'interests' => [
							'group_in_audience_2',
							'local_list_in_audience_2',
						],
					],
				],
			],
		];
	}

	/**
	 * Undocumented function
	 *
	 * @param Subscription_List[] $lists List of Subscription Lists objects.
	 * @param array               $expected Expected return of the function.
	 * @dataProvider prepare_lists_to_add_contact_data
	 * @return void
	 */
	public function test_prepare_lists_to_add_contact( $lists, $expected ) {
		self::create_lists();

		$lists_to_pass = [];
		foreach ( $lists as $list ) {
			$lists_to_pass[] = self::$subscription_lists[ $list ];
		}

		foreach ( $expected as $audience_id => $expected_list ) {
			$tag_real_values = [];
			foreach ( $expected_list['tags'] as $tag ) {
				$tag_real_values[] = self::$subscription_lists[ $tag ]->get_remote_name();
			}

			$interests_real_values = [];
			foreach ( $expected_list['interests'] as $interest ) {
				$interests_real_values[ self::$subscription_lists[ $interest ]->mailchimp_get_sublist_id() ] = true;
			}

			$expected[ $audience_id ] = [
				'tags'      => $tag_real_values,
				'interests' => $interests_real_values,
			];
		}

		$method = self::get_private_method( 'prepare_lists_to_add_contact' );
		$service = Newspack_Newsletters_Mailchimp::instance();

		$result = $method->invoke( $service, $lists_to_pass );
		$this->assertEquals( $expected, $result );
		self::delete_lists();
	}
}

<?php
/**
 * Class Newsletters Test Contact_Add
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Subscription_Lists;
use Newspack\Newsletters\Subscription_List;

/**
 * Tests the Contacts Class.
 */
class Newsletters_Contacts_Test extends WP_UnitTestCase {
	/**
	 * Test set up.
	 */
	public static function set_up_before_class() {
		// Set an ESP.
		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
		update_option( 'newspack_mailchimp_api_key', 'test-us1' );

		Subscription_Lists::get_or_create_remote_list(
			[
				'id'    => 'list1',
				'title' => 'List 1',
			]
		);
		Subscription_Lists::get_or_create_remote_list(
			[
				'id'    => 'list2',
				'title' => 'List 2',
			]
		);
		Subscription_Lists::get_or_create_remote_list(
			[
				'id'    => Subscription_List::mailchimp_create_form_id( 'group1', 'list1' ),
				'title' => 'Group 1',
			]
		);
		Subscription_Lists::get_or_create_remote_list(
			[
				'id'    => Subscription_List::mailchimp_create_form_id( '42', 'list1', 'tag' ),
				'title' => 'Supertag',
			]
		);
		Subscription_Lists::get_or_create_remote_list(
			[
				'id'    => Subscription_List::mailchimp_create_form_id( '42', 'list2', 'tag' ),
				'title' => 'Supertag',
			]
		);
	}

	/**
	 * Subscribe a contact to a single list synchronously.
	 */
	public function test_subscribe_contact() {
		$result = Newspack_Newsletters_Contacts::subscribe(
			[
				'email' => 'test@example.com',
			],
			[ 'list1' ]
		);

		$this->assertEquals(
			[
				'status'  => 'pending',
				'list_id' => 'list1',
			],
			$result
		);
	}

	/**
	 * Subscribe a contact to a single list assynchronously.
	 */
	public function test_subscribe_contact_async() {
		if ( ! defined( 'NEWSPACK_NEWSLETTERS_ASYNC_SUBSCRIPTION_ENABLED' ) ) {
			define( 'NEWSPACK_NEWSLETTERS_ASYNC_SUBSCRIPTION_ENABLED', true );
		}
		$result = Newspack_Newsletters_Contacts::subscribe(
			[
				'email' => 'test@example.com',
			],
			[ 'list1' ],
			true
		);

		// Async subscription should return true.
		$this->assertEquals(
			true,
			$result
		);

		// Hook into the async result.
		$async_result = null;
		add_action(
			'newspack_newsletters_contact_subscribed',
			function( $provider, $contact, $lists, $result, $is_updating, $context ) use ( &$async_result ) {
				$async_result = $result;
			},
			10,
			6
		);

		// Manually trigger subscription intents processing.
		Newspack_Newsletters_Subscription::process_subscription_intents();
		$this->assertEquals(
			[
				'status'  => 'pending',
				'list_id' => 'list1',
			],
			$async_result
		);
	}

	/**
	 * Upsert a contact to a single list.
	 */
	public function test_upsert_contact_to_single_list() {
		$result = Newspack_Newsletters_Contacts::upsert(
			[
				'email' => 'test@example.com',
			],
			[ 'list1' ]
		);
		$this->assertEquals(
			[
				'status'  => 'pending',
				'list_id' => 'list1',
			],
			$result
		);
	}

	/**
	 * Upsert a contact to multiple lists.
	 */
	public function test_upsert_contact_to_multiple_lists() {
		$result = Newspack_Newsletters_Contacts::upsert(
			[
				'email' => 'test@example.com',
			],
			[ 'list1', 'list2' ]
		);
		$this->assertEquals(
			[
				'status'  => 'pending',
				'list_id' => 'list2',
			],
			$result
		);
	}

	/**
	 * Upsert a contact to lists and sublists.
	 */
	public function test_upsert_contact_to_lists_and_sublists() {
		$result = Newspack_Newsletters_Contacts::upsert(
			[
				'email' => 'test@example.com',
			],
			[ 'list1', 'tag-42-list1', 'group-group1-list1' ]
		);
		$this->assertEquals(
			[
				'status'    => 'pending',
				'list_id'   => 'list1',
				'interests' => [ 'group1' => true ],
				'tags'      => [
					[
						'id'   => 42,
						'name' => 'Supertag',
					],
				],
			],
			$result
		);
	}

	/**
	 * Upsert a contact to multiple lists and sublists.
	 */
	public function test_upsert_contact_to_multiple_lists_and_sublists() {
		$result = Newspack_Newsletters_Contacts::upsert(
			[
				'email' => 'test@example.com',
			],
			[ 'list1', 'tag-42-list1', 'group-group1-list1', 'list2', 'tag-42-list2' ]
		);

		$this->assertEquals(
			[
				'status'  => 'pending',
				'list_id' => 'list2',
				'tags'    => [
					[
						'id'   => 42,
						'name' => 'Supertag',
					],
				],
			],
			$result
		);
	}
}

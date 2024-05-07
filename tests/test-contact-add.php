<?php
/**
 * Class Newsletters Test Contact_Add
 *
 * @package Newspack_Newsletters
 */

/**
 * Tests the Contact_Add class
 */
class Contact_Add_Test extends WP_UnitTestCase {
	/**
	 * Test set up.
	 */
	public function set_up() {
		// Set an ESP.
		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
		update_option( 'newspack_mailchimp_api_key', 'test-us1' );
	}

	/**
	 * Add a contact to a single list.
	 */
	public function test_add_contact_to_single_list() {
		$result = Newspack_Newsletters_Subscription::add_contact(
			[
				'email' => 'test@example.com',
			],
			[ 'list1' ]
		);
		$this->assertEquals(
			$result,
			[
				[
					'status'  => 'pending',
					'list_id' => 'list1',
				],
			]
		);
	}

	/**
	 * Add a contact to multiple lists.
	 */
	public function test_add_contact_to_multiple_lists() {
		$result = Newspack_Newsletters_Subscription::add_contact(
			[
				'email' => 'test@example.com',
			],
			[ 'list1', 'list2' ]
		);
		$this->assertEquals(
			$result,
			[
				[
					'status'  => 'pending',
					'list_id' => 'list1',
				],
				[
					'status'  => 'pending',
					'list_id' => 'list2',
				],
			]
		);
	}

	/**
	 * Add a contact to lists and sublists.
	 */
	public function test_add_contact_to_lists_and_sublists() {
		$result = Newspack_Newsletters_Subscription::add_contact(
			[
				'email' => 'test@example.com',
			],
			[ 'list1', 'tag-42-list1', 'group-group1-list1' ]
		);
		$this->assertEquals(
			$result,
			[
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
			]
		);
	}
}

<?php
/**
 * Class Newsletters Test Subscription_Intents
 *
 * @package Newspack_Newsletters
 */

/**
 * Tests Newspack_Newsletters_Subscription::process_subscription_intents.
 */
class Subscription_Intents_Test extends WP_UnitTestCase {
	/**
	 * Make sure the intent CPT is registered for tests.
	 */
	public function set_up() {
		parent::set_up();
		Newspack_Newsletters_Subscription::register_subscription_intents();
	}

	/**
	 * An intent post whose `contact` meta is missing or non-array previously
	 * fataled with "Cannot access offset of type string on string" when the
	 * cron tried to read `$intent['contact']['email']`. The processor must
	 * tolerate that state and remove the malformed intent so the cron stops
	 * looping on it.
	 */
	public function test_process_subscription_intents_removes_intent_with_missing_contact() {
		$intent_id = wp_insert_post(
			[
				'post_type'   => Newspack_Newsletters_Subscription::SUBSCRIPTION_INTENT_CPT,
				'post_status' => 'publish',
				'meta_input'  => [
					// Simulates a corrupted intent: `contact` was cleared and
					// now reads as an empty string via get_post_meta.
					'contact' => '',
					'lists'   => [ 'list1' ],
					'errors'  => [],
					'context' => 'test',
				],
			]
		);

		$this->assertIsInt( $intent_id );

		Newspack_Newsletters_Subscription::process_subscription_intents( $intent_id );

		$this->assertNull(
			get_post( $intent_id ),
			'Malformed intent is removed so it does not keep fataling on every cron tick.'
		);
	}

	/**
	 * Sanity check: when the contact array is missing the `email` key, the
	 * intent is also treated as malformed and removed.
	 */
	public function test_process_subscription_intents_removes_intent_with_emailless_contact() {
		$intent_id = wp_insert_post(
			[
				'post_type'   => Newspack_Newsletters_Subscription::SUBSCRIPTION_INTENT_CPT,
				'post_status' => 'publish',
				'meta_input'  => [
					'contact' => [ 'name' => 'Contact without email' ],
					'lists'   => [ 'list1' ],
					'errors'  => [],
					'context' => 'test',
				],
			]
		);

		Newspack_Newsletters_Subscription::process_subscription_intents( $intent_id );

		$this->assertNull(
			get_post( $intent_id ),
			'Intent with no contact email is removed.'
		);
	}
}

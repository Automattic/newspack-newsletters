<?php
/**
 * Class Test Controlled Statuses
 *
 * @package Newspack_Newsletters
 */

/**
 * Controlled Statuses Test.
 */
class Newsletter_Controlled_Statuses_Test extends WP_UnitTestCase {
	/**
	 * Test set up.
	 */
	public function set_up() {
		// Set an ESP.
		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
	}

	/**
	 * Test that publishing a newsletter without 'is_public' makes it private.
	 */
	public function test_publish_private_newsletter() {
		// Create draft.
		$post_id = self::factory()->post->create(
			[
				'post_type'   => \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				'post_status' => 'draft',
			]
		);
		// Set newsletter as sent.
		\Newspack_Newsletters::set_newsletter_sent( $post_id );
		// Publish newsletter.
		wp_update_post(
			[
				'ID'          => $post_id,
				'post_status' => 'publish',
			]
		);
		// Assert published newsletter is private.
		$result_post = get_post( $post_id );
		$this->assertEquals( 'private', $result_post->post_status );
	}

	/**
	 * Test that publishing a newsletter with 'is_public' makes it public.
	 */
	public function test_publish_public_newsletter() {
		// Create draft.
		$post_id = self::factory()->post->create(
			[
				'post_type'   => \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				'post_status' => 'draft',
			]
		);
		// Add 'is_public' meta.
		update_post_meta( $post_id, 'is_public', true );
		// Set newsletter as sent.
		\Newspack_Newsletters::set_newsletter_sent( $post_id );
		// Publish newsletter.
		wp_update_post(
			[
				'ID'          => $post_id,
				'post_status' => 'publish',
			]
		);
		// Assert published newsletter is publish.
		$result_post = get_post( $post_id );
		$this->assertEquals( 'publish', $result_post->post_status );
	}
}

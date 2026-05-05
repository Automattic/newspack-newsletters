<?php
/**
 * Class Test Layouts Send Suppression
 *
 * @package Newspack_Newsletters
 */

/**
 * Asserts the layouts CPT can never trigger an ESP campaign send.
 *
 * Layouts share the newsletter editor but must never dispatch a campaign.
 * Three layers protect this:
 *
 *   1. Newspack_Newsletters_Service_Provider::pre_post_update returns early
 *      via Newspack_Newsletters::validate_newsletter_id().
 *   2. Newspack_Newsletters_Service_Provider::transition_post_status returns
 *      early via the same gate.
 *   3. Newspack_Newsletters_Service_Provider::send_newsletter has a
 *      belt-and-braces guard at the top — the layer this test pins.
 *
 * Strategy: Mailchimp configured without credentials throws a WPDieException
 * (`Missing or invalid Mailchimp credentials.`) when send is attempted. The
 * sanity-check newsletter scenario must throw; the layout scenario must not.
 */
class Layouts_Send_Suppression_Test extends WP_UnitTestCase {
	/**
	 * Test set up.
	 */
	public function set_up() {
		parent::set_up();

		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
		delete_option( 'newspack_mailchimp_api_key' );

		// Layouts CPT registration is gated on `edit_others_posts`, which is
		// false for the anonymous user that init fires under during bootstrap.
		// Re-register explicitly with admin caps so the test can create and
		// publish layout posts.
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		\Newspack_Newsletters_Layouts::register_layout_cpt();

		add_filter(
			'wp_die_handler',
			function() {
				return 'handle_wpdie_in_tests';
			}
		);
	}

	/**
	 * Sanity check: the parallel newsletter scenario throws. If this stops
	 * throwing, the layout assertion below would silently pass for the wrong
	 * reason.
	 */
	public function test_publishing_unconfigured_newsletter_dispatches_send() {
		$post_id = self::factory()->post->create(
			[
				'post_type'   => \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				'post_status' => 'draft',
			]
		);

		$this->expectException( WPDieException::class );
		$this->expectExceptionMessage( 'Missing or invalid Mailchimp credentials.' );

		wp_update_post(
			[
				'ID'          => $post_id,
				'post_status' => 'publish',
			]
		);
	}

	/**
	 * Publishing a layout must never invoke the provider send pipeline.
	 * Covers both the pre_post_update and transition_post_status paths.
	 */
	public function test_publishing_layout_does_not_dispatch_send() {
		$post_id = self::factory()->post->create(
			[
				'post_type'   => \Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'post_status' => 'draft',
			]
		);

		wp_update_post(
			[
				'ID'          => $post_id,
				'post_status' => 'publish',
			]
		);

		$this->assertSame( 'publish', get_post_status( $post_id ) );
	}

	/**
	 * Direct invocation: even if a future caller bypasses both upstream
	 * gates, send_newsletter itself must short-circuit for layouts.
	 */
	public function test_send_newsletter_short_circuits_for_layouts() {
		$post_id = self::factory()->post->create(
			[
				'post_type'   => \Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'post_status' => 'draft',
			]
		);

		$provider = \Newspack_Newsletters::get_service_provider();
		$result   = $provider->send_newsletter( get_post( $post_id ) );

		$this->assertNull( $result );
	}
}

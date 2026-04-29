<?php
/**
 * Class Test Newsletters List REST
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Admin\Newsletters_List_REST;

/**
 * Tests the REST surface that the Newsletters list DataView consumes.
 *
 * The shape returned by `get_status_for_post` consolidates `post_status`,
 * `is_newsletter_sent()`, and the scheduled-send signal into a single
 * `{ kind, sent_at, scheduled_at }` payload so the React side never has
 * to re-derive sent/scheduled state.
 */
class Newsletters_List_REST_Test extends WP_UnitTestCase {
	/**
	 * Helper: make a newsletter post with optional overrides and meta.
	 *
	 * @param array $args Post args; meta supplied via `meta_input`.
	 * @return int Post ID.
	 */
	private function make_newsletter( $args = [] ) {
		return self::factory()->post->create(
			array_merge(
				[
					'post_type'   => Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
					'post_status' => 'draft',
					'post_title'  => 'Test newsletter',
				],
				$args
			)
		);
	}

	/**
	 * A draft newsletter has kind=draft and no timestamps.
	 */
	public function test_draft_post_reports_draft_kind() {
		$post_id = $this->make_newsletter( [ 'post_status' => 'draft' ] );

		$status = Newsletters_List_REST::get_status_for_post( get_post( $post_id ) );

		$this->assertSame( 'draft', $status['kind'] );
		$this->assertNull( $status['sent_at'] );
		$this->assertNull( $status['scheduled_at'] );
	}

	/**
	 * A published newsletter is treated as sent — `is_newsletter_sent()` will
	 * back-fill `newsletter_sent` meta from the publish date if missing, so
	 * `sent_at` should be populated even without an explicit set call.
	 */
	public function test_published_post_reports_sent_kind() {
		$post_id = $this->make_newsletter(
			[
				'post_status' => 'publish',
				'post_date'   => '2026-04-20 10:00:00',
			]
		);

		$status = Newsletters_List_REST::get_status_for_post( get_post( $post_id ) );

		$this->assertSame( 'sent', $status['kind'] );
		$this->assertIsInt( $status['sent_at'] );
		$this->assertGreaterThan( 0, $status['sent_at'] );
		$this->assertNull( $status['scheduled_at'] );
	}

	/**
	 * A private newsletter (i.e. published but `is_public` was false) is also sent.
	 */
	public function test_private_post_reports_sent_kind() {
		$post_id = $this->make_newsletter(
			[
				'post_status' => 'private',
				'post_date'   => '2026-04-20 10:00:00',
			]
		);

		$status = Newsletters_List_REST::get_status_for_post( get_post( $post_id ) );

		$this->assertSame( 'sent', $status['kind'] );
		$this->assertIsInt( $status['sent_at'] );
	}

	/**
	 * A WP-scheduled post (`post_status=future`) reports kind=scheduled with
	 * `scheduled_at` derived from post_date_gmt.
	 */
	public function test_future_post_reports_scheduled_kind() {
		$future_date = gmdate( 'Y-m-d H:i:s', time() + DAY_IN_SECONDS );
		$post_id     = $this->make_newsletter(
			[
				'post_status' => 'future',
				'post_date'   => $future_date,
			]
		);

		$status = Newsletters_List_REST::get_status_for_post( get_post( $post_id ) );

		$this->assertSame( 'scheduled', $status['kind'] );
		$this->assertNull( $status['sent_at'] );
		$this->assertIsInt( $status['scheduled_at'] );
		$this->assertGreaterThan( time(), $status['scheduled_at'] );
	}

	/**
	 * The `sending_scheduled` meta flag (set when an ESP send is queued)
	 * also marks the newsletter as scheduled even if post_status is still
	 * draft — used during the brief window between scheduling and dispatch.
	 */
	public function test_sending_scheduled_meta_reports_scheduled_kind() {
		$post_id = $this->make_newsletter(
			[
				'post_status' => 'draft',
				'meta_input'  => [ 'sending_scheduled' => true ],
			]
		);

		$status = Newsletters_List_REST::get_status_for_post( get_post( $post_id ) );

		$this->assertSame( 'scheduled', $status['kind'] );
	}

	/**
	 * A trashed newsletter reports kind=trash regardless of any sent state.
	 */
	public function test_trashed_post_reports_trash_kind() {
		$post_id = $this->make_newsletter(
			[
				'post_status' => 'publish',
				'post_date'   => '2026-04-20 10:00:00',
			]
		);
		wp_trash_post( $post_id );

		$status = Newsletters_List_REST::get_status_for_post( get_post( $post_id ) );

		$this->assertSame( 'trash', $status['kind'] );
	}

	/**
	 * The `newspack_newsletters_status` REST field is registered on the
	 * newsletters CPT so it surfaces on `/wp/v2/newspack_nl_cpt` responses.
	 */
	public function test_rest_field_is_registered_on_newsletters_cpt() {
		// Force REST init so register_rest_field callbacks have fired.
		do_action( 'rest_api_init' );

		global $wp_rest_additional_fields;

		$cpt    = Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		$fields = isset( $wp_rest_additional_fields[ $cpt ] ) ? $wp_rest_additional_fields[ $cpt ] : [];

		$this->assertArrayHasKey( 'newspack_newsletters_status', $fields );
		$this->assertIsCallable( $fields['newspack_newsletters_status']['get_callback'] );
	}
}

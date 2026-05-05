<?php
/**
 * Class Test Layouts REST Test-Send
 *
 * @package Newspack_Newsletters
 */

/**
 * Covers the bespoke `POST /newspack-newsletters/v1/layouts/{id}/test`
 * route registered by `Newspack_Newsletters_Layouts::register_rest_routes`.
 *
 * The route bypasses the ESP entirely — it `wp_mail`s the rendered HTML
 * stored in `EMAIL_HTML_META` directly. These tests pin:
 *
 *   - 400 when the request carries no valid emails.
 *   - 409 when the layout has no rendered HTML yet.
 *   - One `wp_mail` call per recipient with a single To:, so addresses
 *     aren't disclosed across recipients.
 *   - Successful sends persist the recipient list to the current user's
 *     `newspack_nl_test_emails` meta.
 *
 * Strategy: hook `pre_wp_mail` to capture the `$atts` payload and
 * short-circuit wp_mail with `true` so no real send is attempted.
 */
class Layouts_REST_Test_Send_Test extends WP_UnitTestCase {
	/**
	 * Captured wp_mail() invocations, populated by `capture_wp_mail`.
	 * Each entry mirrors the `$atts` array (`to`, `subject`, `message`,
	 * `headers`, `attachments`).
	 *
	 * @var array<int, array>
	 */
	private $captured_mail = [];

	/**
	 * Pre-test snapshot of the current user ID so tear_down can restore
	 * it — WP_UnitTestCase doesn't reset the current user between tests.
	 *
	 * @var int
	 */
	private $previous_user_id = 0;

	/**
	 * Test set up.
	 */
	public function set_up() {
		parent::set_up();

		$this->captured_mail    = [];
		$this->previous_user_id = get_current_user_id();

		// The layouts CPT registration is gated on `edit_others_posts`;
		// re-register under an admin so the factory can create posts of
		// this type, and the test-send route's permission check passes.
		// The REST route is registered by the class singleton's
		// `rest_api_init` hook — `rest_do_request` fires that action.
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		\Newspack_Newsletters_Layouts::register_layout_cpt();

		add_filter( 'pre_wp_mail', [ $this, 'capture_wp_mail' ], 10, 2 );
	}

	/**
	 * Test tear down.
	 */
	public function tear_down() {
		remove_filter( 'pre_wp_mail', [ $this, 'capture_wp_mail' ], 10 );
		wp_set_current_user( $this->previous_user_id );

		parent::tear_down();
	}

	/**
	 * `pre_wp_mail` filter: record the call, short-circuit wp_mail with
	 * `true` so the real PHPMailer never runs.
	 *
	 * @param null|bool $short_circuit Existing short-circuit value; replaced
	 *                                 unconditionally.
	 * @param array     $atts          wp_mail attributes (`to`, `subject`,
	 *                                 `message`, `headers`, `attachments`).
	 * @return true Always returns true so wp_mail reports success.
	 */
	public function capture_wp_mail( $short_circuit, $atts ) {
		unset( $short_circuit );
		$this->captured_mail[] = $atts;
		return true;
	}

	/**
	 * Helper: build a layout post with an optional rendered HTML payload.
	 *
	 * @param string $html The HTML to write to EMAIL_HTML_META; empty skips.
	 * @return int Post ID.
	 */
	private function make_layout( $html = '<p>Hello</p>' ) {
		$post_id = self::factory()->post->create(
			[
				'post_type'   => \Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT,
				'post_status' => 'publish',
				'post_title'  => 'Test layout',
			]
		);
		if ( '' !== $html ) {
			update_post_meta( $post_id, Newspack_Newsletters::EMAIL_HTML_META, $html );
		}
		return $post_id;
	}

	/**
	 * No valid emails in the payload → 400, no wp_mail call.
	 */
	public function test_returns_400_when_no_valid_emails() {
		$post_id = $this->make_layout();

		$request = new WP_REST_Request( 'POST', '/newspack-newsletters/v1/layouts/' . $post_id . '/test' );
		$request->set_param( 'test_email', 'not-an-email, also@not, 12345' );

		$response = rest_do_request( $request );

		$this->assertSame( 400, $response->get_status() );
		$this->assertCount( 0, $this->captured_mail );
	}

	/**
	 * Layout has no rendered HTML yet → 409, no wp_mail call.
	 */
	public function test_returns_409_when_layout_has_no_html() {
		$post_id = $this->make_layout( '' );

		$request = new WP_REST_Request( 'POST', '/newspack-newsletters/v1/layouts/' . $post_id . '/test' );
		$request->set_param( 'test_email', 'a@example.com' );

		$response = rest_do_request( $request );

		$this->assertSame( 409, $response->get_status() );
		$this->assertCount( 0, $this->captured_mail );
	}

	/**
	 * Multiple recipients → one wp_mail call each, each with a single
	 * To: (no recipient sees another's address).
	 */
	public function test_sends_one_email_per_recipient_with_single_to() {
		$post_id = $this->make_layout( '<p>Preview</p>' );

		$request = new WP_REST_Request( 'POST', '/newspack-newsletters/v1/layouts/' . $post_id . '/test' );
		$request->set_param( 'test_email', 'a@example.com, b@example.com, c@example.com' );

		$response = rest_do_request( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertCount( 3, $this->captured_mail );
		foreach ( $this->captured_mail as $atts ) {
			// Each call's To: must be a single address — either a string
			// or a one-element array. wp_mail accepts both shapes.
			$to = $atts['to'];
			if ( is_array( $to ) ) {
				$this->assertCount( 1, $to );
				$to = $to[0];
			}
			$this->assertIsString( $to );
			$this->assertStringContainsString( '@example.com', $to );
		}
		$recipients = array_map(
			static function ( $atts ) {
				return is_array( $atts['to'] ) ? $atts['to'][0] : $atts['to'];
			},
			$this->captured_mail
		);
		$this->assertSame( [ 'a@example.com', 'b@example.com', 'c@example.com' ], $recipients );
	}

	/**
	 * Successful send persists the recipient list to the current user's
	 * `newspack_nl_test_emails` meta — mirrors the provider /test handlers.
	 */
	public function test_persists_recipients_to_user_meta_on_success() {
		$post_id = $this->make_layout( '<p>Preview</p>' );

		$request = new WP_REST_Request( 'POST', '/newspack-newsletters/v1/layouts/' . $post_id . '/test' );
		$request->set_param( 'test_email', 'team@example.com, lead@example.com' );

		$response = rest_do_request( $request );

		$this->assertSame( 200, $response->get_status() );
		$stored = get_user_meta( get_current_user_id(), 'newspack_nl_test_emails', true );
		$this->assertSame( [ 'team@example.com', 'lead@example.com' ], $stored );
	}
}

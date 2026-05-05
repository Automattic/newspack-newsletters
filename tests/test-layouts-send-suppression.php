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
	 * Pre-test snapshot of the active service-provider slug, restored in
	 * tear_down so the static class state doesn't leak across tests.
	 * `Newspack_Newsletters::service_provider()` returns `false` when the
	 * underlying option is unset — that case is handled explicitly in
	 * tear_down rather than collapsed into the truthy branch.
	 *
	 * @var string|false
	 */
	private $previous_provider_slug = false;

	/**
	 * Sentinel returned by `get_option` when the option does not exist
	 * (we pass it as the default so we can distinguish "absent" from
	 * "stored as empty string").
	 */
	private const ABSENT = '__absent__';

	/**
	 * Pre-test snapshot of the Mailchimp API key option. WP_UnitTestCase
	 * doesn't roll options back between tests, so set_up snapshots the
	 * pre-existing value and tear_down restores it. When the option is
	 * unset, this holds the `self::ABSENT` sentinel string (not `false`)
	 * so tear_down can distinguish "absent" from "stored as empty".
	 *
	 * @var string The option's current value, or `self::ABSENT` if unset.
	 */
	private $previous_mailchimp_api_key = self::ABSENT;

	/**
	 * Pre-test snapshot of the current user ID. WP_UnitTestCase doesn't
	 * reset the current user between tests, so we restore it explicitly.
	 *
	 * @var int
	 */
	private $previous_user_id = 0;

	/**
	 * Whether the layouts CPT was already registered before set_up ran.
	 * tear_down unregisters when this is false so we don't leak the
	 * post-type registration into later tests in the same process.
	 *
	 * @var bool
	 */
	private $layouts_cpt_was_registered = false;

	/**
	 * Test set up.
	 */
	public function set_up() {
		parent::set_up();

		$this->previous_provider_slug     = \Newspack_Newsletters::service_provider();
		$this->previous_mailchimp_api_key = get_option( 'newspack_mailchimp_api_key', self::ABSENT );
		$this->previous_user_id           = get_current_user_id();
		$this->layouts_cpt_was_registered = post_type_exists( \Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT );

		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
		delete_option( 'newspack_mailchimp_api_key' );

		// Layouts CPT registration is gated on `edit_others_posts`, which is
		// false for the anonymous user that init fires under during bootstrap.
		// Re-register explicitly with admin caps so the test can create and
		// publish layout posts.
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		\Newspack_Newsletters_Layouts::register_layout_cpt();

		add_filter( 'wp_die_handler', [ $this, 'route_wp_die_to_test_handler' ] );
	}

	/**
	 * Test tear down.
	 *
	 * Restores the global state mutated in set_up so the suite can't carry
	 * residue (filter, current user, provider slug, Mailchimp API key) into
	 * later tests.
	 */
	public function tear_down() {
		remove_filter( 'wp_die_handler', [ $this, 'route_wp_die_to_test_handler' ] );

		wp_set_current_user( $this->previous_user_id );

		// Restore the service provider. The option may have been unset
		// before the test ran, in which case `service_provider()` returned
		// `false`; restore that absence by deleting the option and
		// re-memoising so the cached static is null again.
		if ( false !== $this->previous_provider_slug ) {
			\Newspack_Newsletters::set_service_provider( $this->previous_provider_slug );
		} else {
			delete_option( 'newspack_newsletters_service_provider' );
			\Newspack_Newsletters::memoize_service_provider();
		}

		// Restore the Mailchimp API key option. Distinguish "was absent"
		// from "was empty" so we don't accidentally store an empty string
		// where there was nothing.
		if ( self::ABSENT === $this->previous_mailchimp_api_key ) {
			delete_option( 'newspack_mailchimp_api_key' );
		} else {
			update_option( 'newspack_mailchimp_api_key', $this->previous_mailchimp_api_key );
		}

		// Unregister the layouts CPT only if we registered it ourselves;
		// the post-type registry is global and persists across tests.
		if ( ! $this->layouts_cpt_was_registered && post_type_exists( \Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT ) ) {
			unregister_post_type( \Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT );
		}

		parent::tear_down();
	}

	/**
	 * Routes wp_die through the bootstrap-installed test handler so the
	 * call surfaces as a catchable WPDieException instead of exiting the
	 * test process.
	 *
	 * @param callable|null $default_handler The default wp_die handler WP
	 *                                       passes to the filter — accepted
	 *                                       to satisfy the filter signature
	 *                                       and silence static analyzers,
	 *                                       intentionally unused.
	 * @return string The bootstrap-installed handler function name.
	 */
	public function route_wp_die_to_test_handler( $default_handler = null ) {
		unset( $default_handler );
		return 'handle_wpdie_in_tests';
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

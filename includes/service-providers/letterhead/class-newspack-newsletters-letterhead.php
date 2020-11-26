<?php
/**
 * Service Provider: Letterhead
 *
 * Letterhead is a service that provides - er - self-service ads (called promotions)
 * for news-organization newsletters : ). We're optimistically organizing this
 * with service providers both because it's a third-party partner integration, but
 * also because eventually we think Newspack writers who use Letterhead may want to
 * have LH handle the sending.
 *
 * This class includes a bunch of dull methods that don't do anything yet, but are
 * added to satisfy the needs of the interface implemented by Newspack_Newsletters_Service_Provider.
 *
 * @package Newspack
 * @version 0.1.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Class Newspack_Newsletters_Letterhead
 */
final class Newspack_Newsletters_Letterhead extends \Newspack_Newsletters_Service_Provider {
	const LETTERHEAD_WP_OPTION_KEY = 'newspack_newsletters_letterhead_api_key';

	/**
	 * Gets the Letterhead API credentials. Right now, that's just a key : ).
	 *
	 * @return string The user's LH API key.
	 */
	public function api_credentials() {
		$letterhead_key = get_option( self::LETTERHEAD_WP_OPTION_KEY, '' );
		return $letterhead_key;
	}

	/**
	 * Whether we have a complete set of Letterhead credentials.
	 *
	 * @return bool Whether we have the API credentials we need.
	 */
	public function has_api_credentials() {
		$credentials = $this->api_credentials();

		/**
		 * The main thing we care about is that this isn't empty.
		 */
		return ! empty( $credentials );
	}

	/**
	 * Set the desired audience segment for a given email. LH doesn't do this
	 * at the moment.
	 *
	 * @param string $post_id The WP Post Id.
	 * @param string $list_id The audience segment ID.
	 * @return void
	 */
	public function list( $post_id, $list_id ) {}

	/**
	 * Fetch the email campaign by the WP Post ID - if it exits. Or, at least
	 * in spirit. LH Doesn't do this yet.
	 *
	 * @param int $post_id The WP Post Id.
	 * @return void
	 */
	public function retrieve( $post_id ) {}

	/**
	 * `save` is reserved for updating the corresponding email campaign when the WordPress
	 * post is saved - if LH does this later : ).
	 *
	 * @param string  $post_id the WP Post Id.
	 * @param WP_Post $post the whole WP Post for some reason.
	 * @param bool    $update Whether this is an existing post being updated.
	 */
	public function save( $post_id, $post, $update ) {}

	/**
	 * `send` will send the email - 🤞 one day.
	 *
	 * @param string  $new_status The new status.
	 * @param string  $old_status The old status :(.
	 * @param WP_POST $post The WP Post.
	 */
	public function send( $new_status, $old_status, $post ) {}

	/**
	 * `sender` is set aside to set an email's sender information - that is, the
	 * name and email address readers see as the source of the email.
	 *
	 * @param string $post_id The WP Post Id.
	 * @param string $from_name The name readers should see with "from" in their email.
	 * @param string $reply_to The corresponding email address.
	 * @return void
	 */
	public function sender( $post_id, $from_name, $reply_to ) {}

	/**
	 * `set_api_credentials` is reserved to allow users to set their
	 * Letterhead keys (etc) over the WP Rest API.
	 *
	 * @param object $credentials The new LH credentials to save.
	 */
	public function set_api_credentials( $credentials ) {}

	/**
	 * `sync` is here for now to satisfy the interface requirement, but it's
	 * in place to handle syncing ads, the post, and the email with the ESP.
	 *
	 * @param WP_POST $post The WP Post.
	 * @return void
	 */
	public function sync( $post ) {}

	/**
	 * We've included `test` optimistically. There is nothing to send test
	 * just yet. Testing of promotions served via Letterhead are in the
	 * email.
	 *
	 * @param int   $post_id the ID of the WP Post.
	 * @param array $emails An array of emails to send the test to.
	 * @return void
	 */
	public function test( $post_id, $emails ) {}

	/**
	 * We've included `trash` here optimistically. There is nothing to trash
	 * just yet :).
	 *
	 * @param int $post_id The Post ID.
	 */
	public function trash( $post_id ) {}
}


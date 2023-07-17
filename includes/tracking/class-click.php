<?php
/**
 * Newspack Newsletters Click-Tracking.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Tracking;

/**
 * Tracking Click-Tracking Class.
 */
final class Click {
	const QUERY_VAR = 'np_newsletters_click';

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		\add_action( 'init', [ __CLASS__, 'rewrite_rule' ] );
		\add_filter( 'query_vars', [ __CLASS__, 'query_vars' ] );
		\add_action( 'template_redirect', [ __CLASS__, 'handle_url' ] );
		\add_filter( 'newspack_newsletters_process_link', [ __CLASS__, 'process_link' ], 10, 2 );
	}

	/**
	 * Add rewrite rule for tracking url.
	 */
	public static function rewrite_rule() {
		\add_rewrite_rule( 'np-newsletters-click', 'index.php?' . self::QUERY_VAR . '=1', 'top' );
		\add_rewrite_tag( '%' . self::QUERY_VAR . '%', '1' );
	}

	/**
	 * Add query vars.
	 *
	 * @param array $vars Query vars.
	 *
	 * @return array
	 */
	public static function query_vars( $vars = [] ) {
		$vars[] = self::QUERY_VAR;
		return $vars;
	}

	/**
	 * Get tracking URL.
	 *
	 * @return string
	 */
	public static function get_tracking_url() {
		return \home_url( 'np-newsletters-click' );
	}

	/**
	 * Get proxied URL.
	 *
	 * @param int    $newsletter_id Newsletter ID.
	 * @param string $url           Destination URL.
	 *
	 * @return string Proxied URL.
	 */
	public static function get_proxied_url( $newsletter_id, $url ) {
		return add_query_arg(
			[
				'id'  => $newsletter_id,
				'url' => urlencode( $url ),
				'em'  => Utils::get_email_address_tag(),
			],
			self::get_tracking_url()
		);
	}

	/**
	 * Process link.
	 *
	 * @param string $url URL.
	 * @param int    $newsletter_id Newsletter ID.
	 *
	 * @return string
	 */
	public static function process_link( $url, $newsletter_id ) {
		if ( ! $newsletter_id ) {
			return $url;
		}
		return self::get_proxied_url( $newsletter_id, $url );
	}

	/**
	 * Handle proxied URL and redirect to destination.
	 */
	public static function handle_url() {
		if ( ! \get_query_var( self::QUERY_VAR ) ) {
			return;
		}

		$newsletter_id = \intval( $_GET['id'] ?? 0 ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$email_address = \sanitize_email( $_GET['em'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$url           = \sanitize_text_field( \wp_unslash( $_GET['url'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ( ! $url || ! \wp_http_validate_url( $url ) ) {
			\wp_die( 'Invalid URL' );
			exit;
		}

		if ( $newsletter_id ) {
			$clicks = \get_post_meta( $newsletter_id, 'tracking_clicks', true );
			if ( ! $clicks ) {
				$clicks = 0;
			}
			$clicks++;
			\update_post_meta( $newsletter_id, 'tracking_pixel_seen', $clicks );
		}

		/**
		 * Fires when a click is tracked.
		 *
		 * @param int    $newsletter_id Newsletter ID.
		 * @param string $url           Destination URL.
		 */
		do_action( 'newspack_newsletters_tracking_click', $newsletter_id, $email_address, $url );

		\wp_safe_redirect( $url );
		exit;
	}
}
Click::init();

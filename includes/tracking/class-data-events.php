<?php
/**
 * Newspack Newsletters Tracking Data Events Integration.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Tracking;

/**
 * Tracking Data Events Class.
 */
final class Data_Events {
	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'init', [ __CLASS__, 'register_listeners' ] );
	}

	/**
	 * Register listeners.
	 */
	public static function register_listeners() {
		if ( ! method_exists( 'Newspack\Data_Events', 'register_listener' ) ) {
			return;
		}
		\Newspack\Data_Events::register_listener(
			'newspack_newsletters_tracking_pixel_seen',
			'newsletter_opened',
			[ 'newsletter_id', 'email_address' ]
		);
	}
}
Data_Events::init();

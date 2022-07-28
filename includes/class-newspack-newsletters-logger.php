<?php
/**
 * Newspack Newsletters Logger
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Logger.
 */
class Newspack_Newsletters_Logger {
	/**
	 * A logger.
	 *
	 * @param any $payload The payload to log.
	 */
	public static function log( $payload ) {
		if ( ! defined( 'NEWSPACK_LOG_LEVEL' ) || 0 > (int) NEWSPACK_LOG_LEVEL || 'string' !== gettype( $payload ) ) {
			return;
		}

		$header = 'NEWSPACK-NEWSLETTERS';
		if ( class_exists( '\Newspack\Logger' ) ) {
			\Newspack\Logger::log( $payload, $header );
		} else {
			error_log( '[' . $header . ']: ' . $payload ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		}
	}
}

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
	 * @param string $payload The payload to log.
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

	/**
	 * Proxy method to Newspack Manager's Logger.
	 *
	 * @param string $code The log code. Like error_colde for errors, or event_code for debug events.
	 * @param string $message The log message.
	 * @param string $email The email of the user related to the log entry. (shortcut the to user_email inside the $params array).
	 * @param array  $params {
	 *
	 *      Optional. Additional parameters.
	 *
	 *      @type string $type The log type. 'error' or 'debug'.
	 *      @type int    $log_level The log level. Log levels are as follows.
	 *                          1 Normal: Logs only to the local php error log. @see self::local_log for details.
	 *                          2 Watch: Same as Normal but also log to the remote logstash server.
	 *                          3 Alert: Same as watch but will also alert in the newspack alerts slack channel.
	 *                          4 Critical: Same as Watch, but will also send an alert to the main Newspack slack channel.
	 *                          @see self::remote_log for details. This requires a Jetpack connection.
	 *      @type mixed  $data The data to log.
	 *      @type string $user_email The email of the user related to the log entry.
	 *
	 * }
	 *
	 * @return void
	 */
	public static function remote_log( $code, $message, $email = '', $params = [] ) {
		if ( ! class_exists( 'Newspack_Manager\Logger' ) ) {
			return;
		}

		$defaults = [
			'type'       => 'debug',
			'log_level'  => 2,
			'user_email' => $email,
		];

		$params = wp_parse_args( $params, $defaults );

		\Newspack_Manager\Logger::log( $code, $message, $params );

	}
}

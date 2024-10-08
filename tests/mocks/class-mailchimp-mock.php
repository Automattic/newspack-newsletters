<?php // phpcs:ignore WordPress.Files.FileName

namespace DrewM\MailChimp;

/**
 * Mocks the MailChimp class.
 */
class MailChimp {

	/**
	 * Can use the mock API?
	 */
	public static function is_api_configured() {
		return get_option( 'newspack_mailchimp_api_key', false );
	}

	public static function get( $endpoint, $args = [] ) { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		if ( ! self::is_api_configured() ) {
			return [];
		}

		return apply_filters( 'mailchimp_mock_get', [], $endpoint, $args );
	}

	public static function put( $endpoint, $args = [] ) { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		if ( ! self::is_api_configured() ) {
			return [];
		}

		return apply_filters( 'mailchimp_mock_put', [], $endpoint, $args );
	}

	public static function post( $endpoint, $args = [] ) { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		if ( ! self::is_api_configured() ) {
			return [];
		}

		return apply_filters( 'mailchimp_mock_post', [], $endpoint, $args );
	}

	/**
	 * Get the subscriber hash.
	 *
	 * @param string $email Email address.
	 * @return string
	 */
	public static function subscriberHash( $email ) { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid
		return md5( strtolower( $email ) );
	}
}

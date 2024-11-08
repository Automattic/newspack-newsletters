<?php // phpcs:disable Squiz.Commenting, Universal.Files, Generic.Files, WordPress.PHP.DevelopmentFunctions, WordPress.Security

class WP_CLI {
	public static function log( $arg ) {
		error_log( $arg );
	}
	public static function warning( $arg ) {
		error_log( $arg );
	}
	public static function error( $arg ) {
		error_log( $arg );
		throw new Exception( $arg );
	}
	public static function success( $arg ) {
		error_log( $arg );
	}
}

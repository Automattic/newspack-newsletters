<?php
/**
 * Mailchimp Cached data
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

use \DrewM\MailChimp\MailChimp;

/**
 * Mailchimp cached class data
 *
 * This class handles fetching and caching segments and interests data from Mailchimp
 *
 * The purpose of this class is to implement a non-obstrusive cache, in which refreshing the cache will happen in the background in async requests
 * and will never keep the user waiting.
 *
 * The cache is stored in transients, set to last up to 20 minutes. Transients can be stored in the options table or in the object cache, depending
 * on the configuration of the site. But in either case, we can't guarantee it will last 20 minutes, it may expire earlier.
 *
 * In order to avoid the user waiting for the cache to be refreshed, we store the last cached data in an option, with auto_load set to false.
 * If the cache is empty, we'll serve the last cached data immediately, and dispatch an async request to refresh the cache on the backgroun.
 *
 * Also, we have a CRON job that will trigger the async requests to refresh the cache for all lists every 10 minutes.
 */
final class Newspack_Newsletters_Mailchimp_Cached_Data {

	/**
	 * The cache group name
	 *
	 * @var string
	 */
	const CACHE_GROUP = 'newspack_nl_mailchimp_data';

	/**
	 * The last cache option name
	 *
	 * @var string
	 */
	const LAST_CACHE_OPTION_NAME = 'newspack_nl_mailchimp_last_cache';

	/**
	 * The ajax action name used to dispatch the cache refresh
	 *
	 * @var string
	 */
	const AJAX_ACTION = 'newspack_nl_mailchimp_refresh_cached_data';

	/**
	 * The cron hook name that trigger the cache refresh on the background
	 *
	 * @var string
	 */
	const CRON_HOOK = 'newspack_nl_mailchimp_refresh_cache';

	/**
	 * Memoized data to be served across the same request
	 *
	 * @var array
	 */
	private static $memoized_data = [];

	/**
	 * Initializes this class
	 */
	public static function init() {

		if ( 'mailchimp' !== Newspack_Newsletters::service_provider() ) {
			return;
		}

		add_action( 'wp_ajax_' . self::AJAX_ACTION, [ __CLASS__, 'handle_dispatch_refresh' ] );
		add_action( 'wp_ajax_nopriv_' . self::AJAX_ACTION, [ __CLASS__, 'handle_dispatch_refresh' ] );

		add_action( self::CRON_HOOK, [ __CLASS__, 'handle_cron' ] );
		add_filter( 'cron_schedules', [ __CLASS__, 'add_cron_interval' ] ); // phpcs:ignore

		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time(), 'every_10_minutes', self::CRON_HOOK );
		}

	}

	/**
	 * Adds a custom interval to WP Cron
	 *
	 * @param array $schedules The current schedules.
	 *
	 * @return array
	 */
	public static function add_cron_interval( $schedules ) {
		$schedules['every_10_minutes'] = [
			'interval' => 10 * MINUTE_IN_SECONDS,
			'display'  => __( 'Every ten minutes', 'newspack_newsletters' ),
		];
		return $schedules;
	}

	/**
	 * Get segments of a given list
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list segments
	 */
	public static function get_segments( $list_id ) {
		$data = self::get_data( $list_id );
		return $data['segments'] ?? null;
	}

	/**
	 * Get Interest Categories (aka Groups) of a given list
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list interest categories
	 */
	public static function get_interest_categories( $list_id ) {
		$data = self::get_data( $list_id );
		return $data['interest_categories'] ?? null;
	}

	/**
	 * Get folders.
	 *
	 * TODO: This is not cached because the cache structure requires a list ID,
	 * which shouldn't be required for folders.
	 *
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list folders
	 */
	public static function get_folders() {
		return self::fetch_folders();
	}

	/**
	 * Get merge_fields of a given list
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list merge_fields
	 */
	public static function get_merge_fields( $list_id ) {
		$data = self::get_data( $list_id );
		return $data['merge_fields'] ?? null;
	}

	/**
	 * Retrieves the main Mailchimp instance
	 *
	 * @return Newspack_Newsletters_Mailchimp
	 */
	private static function get_mc_instance() {
		return Newspack_Newsletters_Mailchimp::instance();
	}

	/**
	 * Get the cache key for a given list
	 *
	 * @param string $list_id The List ID.
	 * @return string The cache key
	 */
	private static function get_cache_key( $list_id ) {
		return self::CACHE_GROUP . '_' . $list_id;
	}

	/**
	 * Get the option name for the last cached data for a list
	 *
	 * @param string $list_id The List ID.
	 * @return string The option name
	 */
	private static function get_last_cache_option_name( $list_id ) {
		return self::LAST_CACHE_OPTION_NAME . '_' . $list_id;
	}

	/**
	 * Gets the raw data for a given List
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list data with segments and interest_categories
	 */
	private static function get_data( $list_id ) {

		if ( ! empty( self::$memoized_data[ $list_id ] ) ) {
			return self::$memoized_data[ $list_id ];
		}

		Newspack_Newsletters_Logger::log( 'Mailchimp cache: getting data for list ' . $list_id );

		$data = get_transient( self::get_cache_key( $list_id ) );
		if ( $data ) {
			Newspack_Newsletters_Logger::log( 'Mailchimp cache: serving from cache' );
			self::$memoized_data[ $list_id ] = $data;
			return $data;
		}

		$data = self::get_last_cached_data( $list_id );

		if ( ! $data ) {
			// First time we ask for data in this list, let's fetch it from the server.
			Newspack_Newsletters_Logger::log( 'Mailchimp cache: serving from remote service' );
			$data                            = self::refresh_cached_data( $list_id );
			self::$memoized_data[ $list_id ] = $data;
			return $data;
		}

		Newspack_Newsletters_Logger::log( 'Mailchimp cache: serving from last_cache option' );
		self::$memoized_data[ $list_id ] = $data;
		return $data;
	}

	/**
	 * Gets the last cached data for a given List
	 *
	 * After we retrieve the last cached data, we dispatch a refresh request to make sure the cache is up to date,
	 * we also delete the current data to make sure the cache will be refreshed eventually, even if the async request fails for any reason.
	 * If we didn't delete and there was a permanent issue with the Mailchimp connection,
	 * the data would be served from the for ever, and the user would never know there was an error.
	 *
	 * @param string $list_id The List ID.
	 * @return ?array The list data with segments and interest_categories
	 */
	private static function get_last_cached_data( $list_id ) {
		$data = get_option( self::get_last_cache_option_name( $list_id ), [] );
		if ( ! empty( $data ) ) {
			delete_option( self::get_last_cache_option_name( $list_id ) );

			Newspack_Newsletters_Logger::log( 'Mailchimp cache: Dispatching refresh' );
			self::dispatch_refresh( $list_id );

			return $data;
		}
	}

	/**
	 * Dispatches a new request to refresh the cache
	 *
	 * @param string $list_id The List ID.
	 * @return void
	 */
	private static function dispatch_refresh( $list_id ) {

		if ( ! function_exists( 'wp_create_nonce' ) ) {
			require_once ABSPATH . WPINC . '/pluggable.php';
		}

		$url = add_query_arg(
			[
				'action'   => self::AJAX_ACTION,
				'_wpnonce' => wp_create_nonce( self::AJAX_ACTION ),
			],
			admin_url( 'admin-ajax.php' )
		);

		$body = [
			'list_id' => $list_id,
		];

		wp_remote_post(
			$url,
			[
				'timeout'   => 0.01,
				'blocking'  => false,
				'body'      => $body,
				'sslverify' => apply_filters( 'https_local_ssl_verify', false ),
				'cookies'   => $_COOKIE, // phpcs:ignore
			]
		);

	}

	/**
	 * Handles the ajax action to refresh the cache
	 *
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return void
	 */
	public static function handle_dispatch_refresh() {
		Newspack_Newsletters_Logger::log( 'Mailchimp cache: Handling ajax request to refresh cache' );
		check_admin_referer( self::AJAX_ACTION );
		$list_id = isset( $_POST['list_id'] ) ? sanitize_text_field( $_POST['list_id'] ) : null;
		if ( ! $list_id ) {
			die;
		}
		try {
			self::refresh_cached_data( $list_id );
		} catch ( Exception $e ) {
			Newspack_Newsletters_Logger::log( 'Error refreshing cache: ' . $e->getMessage() );
		}
		die;
	}

	/**
	 * Fetches data from the server and updates the cache
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list data with segments and interest_categories
	 */
	private static function refresh_cached_data( $list_id ) {
		Newspack_Newsletters_Logger::log( 'Mailchimp cache: Refreshing cache' );
		try {
			$segments            = self::fetch_segments( $list_id );
			$interest_categories = self::fetch_interest_categories( $list_id );
			$folders             = self::fetch_folders();
			$merge_fields        = self::fetch_merge_fields( $list_id );
			$list_data           = [
				'segments'            => $segments,
				'interest_categories' => $interest_categories,
				'folders'             => $folders,
				'merge_fields'        => $merge_fields,
			];

			// Update the cache.
			set_transient( self::get_cache_key( $list_id ), $list_data, 20 * MINUTE_IN_SECONDS );
			update_option( self::get_last_cache_option_name( $list_id ), $list_data, false );

			return $list_data;
		} catch ( Exception $e ) {
			Newspack_Newsletters_Logger::log( 'Mailchimp cache: error fetching data. Clearing cache to surface errors.' );
			delete_transient( self::get_cache_key( $list_id ) );
			throw $e;
		}
	}

	/**
	 * Clears the cache for a given List
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return void
	 */
	private static function clear_cache( $list_id ) {
		delete_transient( self::get_cache_key( $list_id ) );
		delete_option( self::get_last_cache_option_name( $list_id ) );
	}

	/**
	 * Handles the cron job and triggers the async requests to refresh the cache for all lists
	 *
	 * @return void
	 */
	public static function handle_cron() {
		Newspack_Newsletters_Logger::log( 'Mailchimp cache: Handling cron request to refresh cache' );
		$mc             = new Mailchimp( ( self::get_mc_instance() )->api_key() );
		$lists_response = ( self::get_mc_instance() )->validate(
			$mc->get(
				'lists',
				[
					'count'  => 1000,
					'fields' => [ 'id' ],
				]
			),
			__( 'Error retrieving Mailchimp lists.', 'newspack_newsletters' )
		);
		if ( is_wp_error( $lists_response ) || empty( $lists_response['lists'] ) ) {
			return;
		}

		foreach ( $lists_response['lists'] as $list ) {
			Newspack_Newsletters_Logger::log( 'Mailchimp cache: Dispatching request to refresh cache for list ' . $list['id'] );
			self::dispatch_refresh( $list['id'] );
		}

	}

	/**
	 * Fetches the segments for a given List from the Mailchimp server
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list segments
	 */
	private static function fetch_segments( $list_id ) {
		$mc       = new Mailchimp( ( self::get_mc_instance() )->api_key() );
		$segments = [];

		$saved_segments_response  = ( self::get_mc_instance() )->validate(
			$mc->get(
				"lists/$list_id/segments",
				[
					'type'  => 'saved',
					'count' => 1000,
				],
				60
			),
			__( 'Error retrieving Mailchimp segments.', 'newspack_newsletters' )
		);
		$static_segments_response = ( self::get_mc_instance() )->validate(
			$mc->get(
				"lists/$list_id/segments",
				[
					'type'  => 'static',
					'count' => 1000,
				],
				60
			),
			__( 'Error retrieving Mailchimp segments.', 'newspack_newsletters' )
		);
		$segments                 = array_merge( $saved_segments_response['segments'], $static_segments_response['segments'] );

		return $segments;
	}

	/**
	 * Fetches the interest_categories (aka Groups) for a given List from the Mailchimp server
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list interest_categories
	 */
	private static function fetch_interest_categories( $list_id ) {
		$mc                  = new Mailchimp( ( self::get_mc_instance() )->api_key() );
		$interest_categories = $list_id ? ( self::get_mc_instance() )->validate(
			$mc->get( "lists/$list_id/interest-categories", [ 'count' => 1000 ], 60 ),
			__( 'Error retrieving Mailchimp groups.', 'newspack_newsletters' )
		) : null;

		if ( $interest_categories && count( $interest_categories['categories'] ) ) {
			foreach ( $interest_categories['categories'] as &$category ) {
				$category_id           = $category['id'];
				$category['interests'] = ( self::get_mc_instance() )->validate(
					$mc->get( "lists/$list_id/interest-categories/$category_id/interests", [ 'count' => 1000 ], 60 ),
					__( 'Error retrieving Mailchimp groups.', 'newspack_newsletters' )
				);
			}
		}

		return $interest_categories;
	}

	/**
	 * Fetches the campaign folders.
	 *
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list folders
	 */
	private static function fetch_folders() {
		$mc       = new Mailchimp( ( self::get_mc_instance() )->api_key() );
		$response = ( self::get_mc_instance() )->validate(
			$mc->get( 'campaign-folders', [ 'count' => 1000 ], 60 ),
			__( 'Error retrieving Mailchimp folders.', 'newspack_newsletters' )
		);
		return $response['folders'];
	}

	/**
	 * Fetches the merge fields for a given List from the Mailchimp server
	 *
	 * @param string $list_id The List ID.
	 * @throws Exception In case of errors while fetching data from the server.
	 * @return array The list interest_categories
	 */
	private static function fetch_merge_fields( $list_id ) {
		$mc       = new Mailchimp( ( self::get_mc_instance() )->api_key() );
		$response = ( self::get_mc_instance() )->validate(
			$mc->get(
				"lists/$list_id/merge-fields",
				[
					'count' => 1000,
				],
				60
			),
			__( 'Error retrieving Mailchimp list merge fields.', 'newspack_newsletters' )
		);
		return $response['merge_fields'];
	}
}

Newspack_Newsletters_Mailchimp_Cached_Data::init();

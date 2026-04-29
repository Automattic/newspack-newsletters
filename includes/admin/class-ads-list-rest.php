<?php
/**
 * REST surface for the Newsletter Ads list DataView.
 *
 * Adds a read-only `newspack_newsletters_ad_status` field on the ads CPT
 * that consolidates `post_status` and the date-driven lifecycle
 * (`start_date` / `expiry_date` meta) into a single payload, so the
 * React side never has to re-derive state from raw meta.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

use Newspack_Newsletters\Ads;
use WP_Post;

/**
 * Register the REST field powering the ads list view's Status column.
 */
class Ads_List_REST {
	const STATUS_QUERY_PARAM = 'newspack_newsletters_ad_status';

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_fields' ] );
		add_action( 'init', [ __CLASS__, 'register_meta' ] );
		add_filter(
			'rest_' . Ads::CPT . '_query',
			[ __CLASS__, 'filter_rest_query' ],
			10,
			2
		);
	}

	/**
	 * Register tracking impression / click meta on the ads CPT subtype
	 * so the React columns can read them via the REST `meta` block and
	 * sort via `orderby=meta_value_num`. The meta is written by the
	 * tracking layer (`Newspack_Newsletters\Tracking\Click` and
	 * `Ads::track_ad_impression`) but was never previously registered,
	 * so it didn't surface in REST.
	 */
	public static function register_meta() {
		register_post_meta(
			Ads::CPT,
			'tracking_impressions',
			[
				'show_in_rest'  => true,
				'type'          => 'integer',
				'single'        => true,
				'auth_callback' => '__return_true',
				'default'       => 0,
			]
		);
		register_post_meta(
			Ads::CPT,
			'tracking_clicks',
			[
				'show_in_rest'  => true,
				'type'          => 'integer',
				'single'        => true,
				'auth_callback' => '__return_true',
				'default'       => 0,
			]
		);
	}

	/**
	 * Valid kind values accepted on the `STATUS_QUERY_PARAM`. Anything
	 * outside this list is ignored so unexpected input can't widen the
	 * result set.
	 */
	const VALID_KINDS = [ 'active', 'scheduled', 'expired', 'draft', 'trash' ];

	/**
	 * Translate the React list's kind-based status filter
	 * (`active|scheduled|expired|draft|trash`) into native query args
	 * plus a one-shot `posts_where` callback that ORs each selected
	 * kind into its own complete bucket (`post_status` + the
	 * date-driven meta condition where applicable). The Status column
	 * renders the derived kind, and the filter targets the same kinds
	 * — so the displayed and filtered sets always match.
	 *
	 * The bucketed `posts_where` approach is what lets us mix
	 * non-publish kinds (`draft`/`trash`) with publish-driven kinds
	 * (`active`/`scheduled`/`expired`) in the same selection: a plain
	 * draft row passes the `draft` bucket without having to satisfy
	 * any meta condition, while an expired row passes the `expired`
	 * bucket only when its `expiry_date` meta is in the past. A flat
	 * `meta_query` would AND the meta condition across all rows and
	 * silently drop the drafts.
	 *
	 * @param array            $args    Query args being assembled.
	 * @param \WP_REST_Request $request Incoming REST request.
	 * @return array
	 */
	public static function filter_rest_query( $args, $request ) {
		$value = $request->get_param( self::STATUS_QUERY_PARAM );
		if ( null === $value || '' === $value ) {
			return $args;
		}

		$raw_kinds = is_array( $value ) ? $value : explode( ',', (string) $value );
		$kinds     = array_values(
			array_intersect(
				self::VALID_KINDS,
				array_map( 'trim', $raw_kinds )
			)
		);

		if ( empty( $kinds ) ) {
			return $args;
		}

		global $wpdb;
		$today = gmdate( 'Y-m-d' );

		$post_status_set = [];
		$bucket_clauses  = [];

		foreach ( $kinds as $kind ) {
			switch ( $kind ) {
				case 'trash':
					$post_status_set[] = 'trash';
					$bucket_clauses[]  = "{$wpdb->posts}.post_status = 'trash'";
					break;
				case 'draft':
					$post_status_set    = array_merge( $post_status_set, [ 'draft', 'pending', 'auto-draft' ] );
					$bucket_clauses[]   = "{$wpdb->posts}.post_status IN ( 'draft', 'pending', 'auto-draft' )";
					break;
				case 'expired':
					$post_status_set[] = 'publish';
					$bucket_clauses[]  = $wpdb->prepare(
						"( {$wpdb->posts}.post_status = 'publish' AND EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key = 'expiry_date' AND meta_value <> '' AND meta_value < %s ) )",
						$today
					);
					break;
				case 'scheduled':
					$post_status_set[] = 'publish';
					$bucket_clauses[]  = $wpdb->prepare(
						"( {$wpdb->posts}.post_status = 'publish' AND EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key = 'start_date' AND meta_value <> '' AND meta_value > %s ) )",
						$today
					);
					break;
				case 'active':
					$post_status_set[] = 'publish';
					$bucket_clauses[]  = $wpdb->prepare(
						"( {$wpdb->posts}.post_status = 'publish'"
						. " AND ( NOT EXISTS ( SELECT 1 FROM {$wpdb->postmeta} sm1 WHERE sm1.post_id = {$wpdb->posts}.ID AND sm1.meta_key = 'start_date' AND sm1.meta_value <> '' )"
						. " OR EXISTS ( SELECT 1 FROM {$wpdb->postmeta} sm2 WHERE sm2.post_id = {$wpdb->posts}.ID AND sm2.meta_key = 'start_date' AND sm2.meta_value <> '' AND sm2.meta_value <= %s ) )"
						. " AND ( NOT EXISTS ( SELECT 1 FROM {$wpdb->postmeta} em1 WHERE em1.post_id = {$wpdb->posts}.ID AND em1.meta_key = 'expiry_date' AND em1.meta_value <> '' )"
						. " OR EXISTS ( SELECT 1 FROM {$wpdb->postmeta} em2 WHERE em2.post_id = {$wpdb->posts}.ID AND em2.meta_key = 'expiry_date' AND em2.meta_value <> '' AND em2.meta_value >= %s ) ) )",
						$today,
						$today
					);
					break;
			}
		}

		$args['post_status'] = array_values( array_unique( $post_status_set ) );

		$callback = static function ( $where ) use ( &$callback, $bucket_clauses ) {
			$where .= ' AND ( ' . implode( ' OR ', $bucket_clauses ) . ' )';
			remove_filter( 'posts_where', $callback, 10 );
			return $where;
		};
		add_filter( 'posts_where', $callback, 10, 1 );

		return $args;
	}

	/**
	 * Register REST fields on the ads CPT.
	 */
	public static function register_rest_fields() {
		register_rest_field(
			Ads::CPT,
			'newspack_newsletters_ad_status',
			[
				'get_callback' => [ __CLASS__, 'rest_get_status' ],
				'schema'       => [
					'context'    => [ 'view', 'edit' ],
					'type'       => 'object',
					'readonly'   => true,
					'properties' => [
						'kind'       => [
							'type' => 'string',
							'enum' => [ 'active', 'scheduled', 'expired', 'draft', 'trash' ],
						],
						'starts_at'  => [
							'type' => [ 'integer', 'null' ],
						],
						'expires_at' => [
							'type' => [ 'integer', 'null' ],
						],
					],
				],
			]
		);
	}

	/**
	 * REST `get_callback` adapter — receives the prepared post array.
	 *
	 * @param array            $post_array  Prepared post response.
	 * @param string           $field_name  Field name (unused).
	 * @param \WP_REST_Request $request     Request object (unused).
	 * @param string           $object_type Object type (unused).
	 * @return array Status payload.
	 */
	public static function rest_get_status( $post_array, $field_name = '', $request = null, $object_type = '' ) {
		unset( $field_name, $request, $object_type );
		$post = isset( $post_array['id'] ) ? get_post( $post_array['id'] ) : null;
		return self::get_status_for_post( $post );
	}
	/**
	 * Compute the consolidated status payload for an ad post.
	 *
	 * @param WP_Post|null $post Post object.
	 * @return array { kind, starts_at, expires_at }
	 */
	public static function get_status_for_post( $post ) {
		$payload = [
			'kind'       => 'draft',
			'starts_at'  => null,
			'expires_at' => null,
		];

		if ( ! $post instanceof WP_Post ) {
			return $payload;
		}

		if ( 'trash' === $post->post_status ) {
			$payload['kind'] = 'trash';
			return $payload;
		}

		if ( 'publish' === $post->post_status ) {
			$today       = gmdate( 'Y-m-d' );
			$start_date  = (string) get_post_meta( $post->ID, 'start_date', true );
			$expiry_date = (string) get_post_meta( $post->ID, 'expiry_date', true );

			if ( '' !== $start_date ) {
				$payload['starts_at'] = strtotime( $start_date . ' 00:00:00 UTC' );
			}
			if ( '' !== $expiry_date ) {
				$payload['expires_at'] = strtotime( $expiry_date . ' 00:00:00 UTC' );
			}

			if ( '' !== $expiry_date && $expiry_date < $today ) {
				$payload['kind'] = 'expired';
				return $payload;
			}
			if ( '' !== $start_date && $start_date > $today ) {
				$payload['kind'] = 'scheduled';
				return $payload;
			}
			$payload['kind'] = 'active';
			return $payload;
		}

		return $payload;
	}
}

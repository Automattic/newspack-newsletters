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
	use Status_Filter_Builder;

	const STATUS_QUERY_PARAM = 'newspack_newsletters_ad_status';

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_fields' ] );
		add_action( 'init', [ __CLASS__, 'register_meta' ] );
		add_filter(
			'rest_' . Ads::CPT . '_collection_params',
			[ __CLASS__, 'extend_collection_params' ]
		);
		add_filter(
			'rest_' . Ads::CPT . '_query',
			[ __CLASS__, 'filter_rest_query' ],
			10,
			2
		);
		add_filter(
			'rest_' . Ads::CPT . '_query',
			[ __CLASS__, 'translate_virtual_orderby' ],
			20,
			2
		);
		add_filter( 'posts_clauses', [ __CLASS__, 'apply_meta_sort_clauses' ], 10, 2 );
	}

	/**
	 * Virtual REST orderby tokens. Applied via posts_clauses LEFT JOIN
	 * in `apply_meta_sort_clauses`, not WP_Query meta args.
	 */
	const VIRTUAL_ORDERBY_TOKENS = [
		'start_date'  => [
			'meta_key' => 'start_date',
			'is_num'   => false,
		],
		'expiry_date' => [
			'meta_key' => 'expiry_date',
			'is_num'   => false,
		],
		'price'       => [
			'meta_key' => 'price',
			'is_num'   => true,
		],
		'impressions' => [
			'meta_key' => 'tracking_impressions',
			'is_num'   => true,
		],
		'clicks'      => [
			'meta_key' => 'tracking_clicks',
			'is_num'   => true,
		],
	];

	/**
	 * Register tracking impression / click meta on the ads CPT subtype
	 * so the React columns can read them via the REST `meta` block and
	 * sort via `orderby=meta_value_num`. The meta is written by the
	 * tracking layer (`Newspack_Newsletters\Tracking\Click` and
	 * `Ads::track_ad_impression`) but was never previously registered,
	 * so it didn't surface in REST.
	 *
	 * `auth_callback` returns `false` so the meta is read-only via
	 * REST — these are server-managed telemetry counters and the
	 * posts endpoint must not accept client writes (stats tampering
	 * vector). Direct `update_post_meta()` calls from the tracking
	 * layer aren't gated by `auth_callback` and continue to work; the
	 * gate only fires on the REST update path's `current_user_can(
	 * 'edit_post_meta', … )` check. The schema also declares
	 * `readonly: true` so REST clients see the field as documentation-
	 * level read-only.
	 */
	public static function register_meta() {
		$readonly_counter_args = [
			'show_in_rest'  => [
				'schema' => [
					'type'     => 'integer',
					'readonly' => true,
				],
			],
			'type'          => 'integer',
			'single'        => true,
			'auth_callback' => '__return_false',
			'default'       => 0,
		];
		register_post_meta( Ads::CPT, 'tracking_impressions', $readonly_counter_args );
		register_post_meta( Ads::CPT, 'tracking_clicks', $readonly_counter_args );
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
		$kinds = array_values(
			array_intersect( self::VALID_KINDS, self::parse_status_values( $request->get_param( self::STATUS_QUERY_PARAM ) ) )
		);
		if ( empty( $kinds ) ) {
			return $args;
		}

		global $wpdb;
		$today = gmdate( 'Y-m-d' );

		$post_status_set = [];
		$bucket_clauses  = [];

		// `private` is treated as publish-equivalent for the lifecycle
		// kinds: a private ad with valid dates is functionally a published
		// ad with restricted visibility, so it should surface in the same
		// active/scheduled/expired buckets as a public publish row. The
		// React list also requests `private` by default (see
		// `DEFAULT_STATUSES` in build-query.js), so excluding it here
		// would make private rows disappear the moment any kind filter
		// is applied.
		//
		// `future` (WP-scheduled via the standard Publish-Schedule UI)
		// is folded into the `scheduled` bucket only — those rows haven't
		// published yet, so `active` and `expired` lifecycle resolution
		// doesn't apply.
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
					$post_status_set    = array_merge( $post_status_set, [ 'publish', 'private' ] );
					$bucket_clauses[]   = $wpdb->prepare(
						"( {$wpdb->posts}.post_status IN ( 'publish', 'private' ) AND EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key = 'expiry_date' AND meta_value <> '' AND meta_value < %s ) )",
						$today
					);
					break;
				case 'scheduled':
					$post_status_set    = array_merge( $post_status_set, [ 'publish', 'private', 'future' ] );
					$bucket_clauses[]   = $wpdb->prepare(
						"( ( {$wpdb->posts}.post_status IN ( 'publish', 'private' ) AND EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key = 'start_date' AND meta_value <> '' AND meta_value > %s ) ) OR {$wpdb->posts}.post_status = 'future' )",
						$today
					);
					break;
				case 'active':
					$post_status_set    = array_merge( $post_status_set, [ 'publish', 'private' ] );
					$bucket_clauses[]   = $wpdb->prepare(
						"( {$wpdb->posts}.post_status IN ( 'publish', 'private' )"
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

		return self::install_bucket_filter( $args, $bucket_clauses, '_newspack_ads_bucket_token' );
	}

	/**
	 * Widen the REST orderby enum to accept our virtual tokens.
	 * Required because `rest_validate_request_arg` runs the enum
	 * check before the `rest_${CPT}_query` filter can rewrite.
	 *
	 * @param array $params Collection params from the posts controller.
	 * @return array
	 */
	public static function extend_collection_params( $params ) {
		if ( isset( $params['orderby']['enum'] ) && is_array( $params['orderby']['enum'] ) ) {
			$params['orderby']['enum'] = array_values(
				array_unique(
					array_merge(
						$params['orderby']['enum'],
						array_keys( self::VIRTUAL_ORDERBY_TOKENS )
					)
				)
			);
		}
		return $params;
	}

	/**
	 * Query var carrying meta-sort intent through to apply_meta_sort_clauses.
	 */
	const META_SORT_QUERY_VAR = 'newspack_ads_meta_sort';

	/**
	 * Stash meta-sort intent on the query args.
	 *
	 * @param array            $args    Prepared WP_Query args.
	 * @param \WP_REST_Request $request Incoming REST request.
	 * @return array
	 */
	public static function translate_virtual_orderby( $args, $request ) {
		unset( $request );
		$orderby = isset( $args['orderby'] ) ? $args['orderby'] : null;
		if ( ! is_string( $orderby ) || ! isset( self::VIRTUAL_ORDERBY_TOKENS[ $orderby ] ) ) {
			return $args;
		}
		$mapping = self::VIRTUAL_ORDERBY_TOKENS[ $orderby ];

		$args['orderby'] = 'none';
		$args[ self::META_SORT_QUERY_VAR ] = [
			'meta_key' => $mapping['meta_key'],
			'is_num'   => $mapping['is_num'],
			'order'    => ( isset( $args['order'] ) && 'asc' === strtolower( (string) $args['order'] ) ) ? 'ASC' : 'DESC',
		];

		return $args;
	}

	/**
	 * LEFT JOIN postmeta and order by it so rows missing the sorted key
	 * still appear (a plain meta_key would inner-join them out).
	 *
	 * @param array     $clauses WP_Query SQL clauses.
	 * @param \WP_Query $query   The WP_Query running the SQL.
	 * @return array
	 */
	public static function apply_meta_sort_clauses( $clauses, $query ) {
		if ( ! ( $query instanceof \WP_Query ) || Ads::CPT !== $query->get( 'post_type' ) ) {
			return $clauses;
		}
		$sort = $query->get( self::META_SORT_QUERY_VAR );
		if ( ! is_array( $sort ) || empty( $sort['meta_key'] ) ) {
			return $clauses;
		}
		global $wpdb;
		$clauses['join'] .= $wpdb->prepare(
			" LEFT JOIN {$wpdb->postmeta} AS newspack_sort_meta ON newspack_sort_meta.post_id = {$wpdb->posts}.ID AND newspack_sort_meta.meta_key = %s",
			$sort['meta_key']
		);
		// `+ 0` coerces to DOUBLE so decimal prices don't truncate (matches WP_Query's meta_value_num).
		$value_expr = ! empty( $sort['is_num'] ) ? 'newspack_sort_meta.meta_value + 0' : 'newspack_sort_meta.meta_value'; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
		$order = ( isset( $sort['order'] ) && 'ASC' === $sort['order'] ) ? 'ASC' : 'DESC';
		$clauses['orderby'] = $value_expr . ' ' . $order . ", {$wpdb->posts}.ID DESC";
		return $clauses;
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

		// WP-scheduled ads (the standard Publish-Schedule UI sets
		// `post_status=future`) resolve to `scheduled`. The React
		// renderer reads `starts_at` to show "Starts <date>", so we
		// expose `post_date_gmt` as the timestamp — that's the moment
		// WordPress will auto-publish the row. `start_date` /
		// `expiry_date` meta are ignored on `future` rows; WP's own
		// scheduling owns the lifecycle until the row publishes.
		if ( 'future' === $post->post_status ) {
			$payload['kind']      = 'scheduled';
			$starts_at            = strtotime( $post->post_date_gmt . ' UTC' );
			$payload['starts_at'] = false === $starts_at ? null : $starts_at;
			return $payload;
		}

		// `private` is treated as publish-equivalent for kind resolution:
		// a private ad with valid dates is functionally a published ad
		// with restricted visibility, so it should surface as
		// active/scheduled/expired the same way. Falling through to the
		// `draft` default would mislabel the row in the list and hide it
		// from the lifecycle filters.
		if ( in_array( $post->post_status, [ 'publish', 'private' ], true ) ) {
			$today       = gmdate( 'Y-m-d' );
			$start_date  = (string) get_post_meta( $post->ID, 'start_date', true );
			$expiry_date = (string) get_post_meta( $post->ID, 'expiry_date', true );

			// Use noon UTC so the resulting timestamp lands on the
			// intended calendar day in any reasonable site timezone —
			// midnight UTC would render as the previous day for users
			// behind UTC. The underlying meta is date-only, so the
			// time-of-day component is just a presentation safeguard.
			// Normalise `strtotime` failures to `null` so the REST
			// schema's `integer|null` declaration holds even if the
			// meta is malformed.
			if ( '' !== $start_date ) {
				$starts_at            = strtotime( $start_date . ' 12:00:00 UTC' );
				$payload['starts_at'] = false === $starts_at ? null : $starts_at;
			}
			if ( '' !== $expiry_date ) {
				$expires_at            = strtotime( $expiry_date . ' 12:00:00 UTC' );
				$payload['expires_at'] = false === $expires_at ? null : $expires_at;
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

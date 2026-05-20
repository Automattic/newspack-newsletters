<?php
/**
 * REST surface for the Newsletters list DataView.
 *
 * Adds a read-only `newspack_newsletters_status` field on the newsletters
 * CPT that consolidates `post_status`, `is_newsletter_sent()`, and the
 * scheduled-send signals into a single payload, so the React side never
 * has to re-derive sent/scheduled state from raw meta.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

use Newspack_Newsletters;
use WP_Post;

/**
 * Register the REST field powering the list view's Status column.
 */
class Newsletters_List_REST {
	const IS_PUBLIC_QUERY_PARAM = 'newspack_newsletters_is_public';
	const SEND_LIST_QUERY_PARAM = 'newspack_newsletters_send_list_id';

	/**
	 * Defensive cap on each filter-options query so a site with tens of
	 * thousands of newsletters can't blow up the payload (or the SQL).
	 */
	const FILTER_OPTIONS_LIMIT = 500;

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_fields' ] );
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
		add_filter(
			'rest_' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_query',
			[ __CLASS__, 'filter_rest_query' ],
			10,
			2
		);
		add_filter(
			'rest_' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_query',
			[ __CLASS__, 'align_status_filter_with_scheduled_meta' ],
			10,
			2
		);
		add_filter(
			'rest_' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_query',
			[ __CLASS__, 'filter_send_list_query' ],
			10,
			2
		);
	}

	/**
	 * Translate the React list's `newspack_newsletters_is_public` query arg
	 * into a `meta_query` clause so the Public-page filter actually narrows
	 * the result set. Strict whitelist: accepts only `'1'` / `'0'` (or
	 * boolean `true` / `false`) — anything else is ignored so unexpected
	 * values can't silently flip the filter.
	 *
	 * @param array            $args    Query args being assembled.
	 * @param \WP_REST_Request $request Incoming REST request.
	 * @return array
	 */
	public static function filter_rest_query( $args, $request ) {
		$value = $request->get_param( self::IS_PUBLIC_QUERY_PARAM );

		if ( true === $value || '1' === $value || 1 === $value ) {
			$is_public = true;
		} elseif ( false === $value || '0' === $value || 0 === $value ) {
			$is_public = false;
		} else {
			// Null, empty string, or anything outside the whitelist — pass through.
			return $args;
		}

		$clause = $is_public
			? [
				'key'     => 'is_public',
				'value'   => '1',
				'compare' => '=',
			]
			: [
				'relation' => 'OR',
				[
					'key'     => 'is_public',
					'compare' => 'NOT EXISTS',
				],
				[
					'key'     => 'is_public',
					'value'   => '1',
					'compare' => '!=',
				],
			];

		if ( empty( $args['meta_query'] ) ) {
			$args['meta_query'] = []; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}
		$args['meta_query'][] = $clause; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query

		return $args;
	}

	/**
	 * Align the Status filter with the kind `get_status_for_post` would
	 * emit. The DataView filter values are raw `post_status` strings,
	 * but the column derives Sent/Scheduled/Draft from a mix of status
	 * and `sending_scheduled` / `scheduling_error` meta. Without this
	 * adapter, raw post_status filtering misclassifies rows in both
	 * directions (e.g. an in-flight publish leaks under Sent; a
	 * publish-with-`scheduling_error` is invisible under Draft).
	 *
	 * Strategy: map the selection to kinds (sent/draft/scheduled/trash),
	 * widen `post_status` to every status the chosen kinds' SQL branches
	 * reference (so WP_Query doesn't strip away reachable rows), and
	 * install a `posts_where` whose OR-branches encode the renderer's
	 * exact conditions for each chosen kind. The callback removes itself
	 * after firing so it stays scoped to the single query.
	 *
	 * @param array            $args    Query args being assembled.
	 * @param \WP_REST_Request $request Incoming REST request.
	 * @return array
	 */
	public static function align_status_filter_with_scheduled_meta( $args, $request ) {
		$status = $request->get_param( 'status' );
		if ( is_array( $status ) ) {
			$values = array_map( 'strval', $status );
		} else {
			$values = '' === $status || null === $status ? [] : explode( ',', (string) $status );
		}
		$values = array_values(
			array_unique(
				array_filter(
					array_map( 'trim', $values ),
					static function ( $v ) {
						return '' !== $v;
					}
				)
			)
		);

		if ( empty( $values ) ) {
			return $args;
		}

		$wants_sent      = ! empty( array_intersect( $values, [ 'publish', 'private' ] ) );
		$wants_draft     = ! empty( array_intersect( $values, [ 'draft', 'pending', 'auto-draft' ] ) );
		$wants_scheduled = in_array( 'future', $values, true );
		$wants_trash     = in_array( 'trash', $values, true );

		// Widen `post_status` to every status the chosen kinds' SQL
		// branches reference. WP_Query applies `post_status IN (...)`
		// before our `posts_where` fires, so anything outside the
		// widened set is unreachable.
		$widened = $values;
		if ( $wants_sent || $wants_draft || $wants_scheduled ) {
			$widened = array_merge( $widened, [ 'publish', 'private' ] );
		}
		if ( $wants_draft || $wants_scheduled ) {
			$widened = array_merge( $widened, [ 'draft', 'pending', 'auto-draft' ] );
		}
		if ( $wants_scheduled ) {
			$widened[] = 'future';
		}
		$widened = array_values( array_unique( $widened ) );
		if ( $widened !== $values ) {
			$args['post_status'] = $widened;
		}

		// Token-scope the closure: `posts_where` fires for every WP_Query in the request, so
		// without this gate a nested query corrupts the WHERE and self-removes the filter
		// before our intended query runs.
		$token                             = uniqid( 'newspack_nl_bucket_', true );
		$args['_newspack_nl_bucket_token'] = $token;

		$callback = static function ( $where, $wp_query ) use ( &$callback, $token, $wants_sent, $wants_draft, $wants_scheduled, $wants_trash ) {
			if ( ! is_object( $wp_query ) || $wp_query->get( '_newspack_nl_bucket_token' ) !== $token ) {
				return $where;
			}
			global $wpdb;
			$clauses      = [];
			$prepare_args = [];

			if ( $wants_trash ) {
				$clauses[]      = "{$wpdb->posts}.post_status = %s";
				$prepare_args[] = 'trash';
			}
			if ( $wants_sent ) {
				$clauses[] = "( {$wpdb->posts}.post_status IN (%s, %s) AND NOT EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key IN (%s, %s) AND meta_value <> '' ) )";
				array_push( $prepare_args, 'publish', 'private', 'sending_scheduled', 'scheduling_error' );
			}
			if ( $wants_scheduled ) {
				$clauses[] = "( {$wpdb->posts}.post_status <> %s AND ( {$wpdb->posts}.post_status = %s OR EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key = %s AND meta_value <> '' ) ) )";
				array_push( $prepare_args, 'trash', 'future', 'sending_scheduled' );
			}
			if ( $wants_draft ) {
				$clauses[] = "( NOT EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key = %s AND meta_value <> '' ) AND ( {$wpdb->posts}.post_status IN (%s, %s, %s) OR ( {$wpdb->posts}.post_status IN (%s, %s) AND EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key = %s AND meta_value <> '' ) ) ) )";
				array_push( $prepare_args, 'sending_scheduled', 'draft', 'pending', 'auto-draft', 'publish', 'private', 'scheduling_error' );
			}

			if ( ! empty( $clauses ) ) {
				$sql    = ' AND ( ' . implode( ' OR ', $clauses ) . ' )';
				$where .= $wpdb->prepare( $sql, $prepare_args ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $sql is composed from a fixed set of `%s` placeholders.
			}

			remove_filter( 'posts_where', $callback, 10 );
			return $where;
		};
		add_filter( 'posts_where', $callback, 10, 2 );

		return $args;
	}

	/**
	 * Narrow to newsletters whose `send_list_id` meta matches one of
	 * the requested IDs. Accepts comma-separated string or array.
	 *
	 * @param array            $args    Query args being assembled.
	 * @param \WP_REST_Request $request Incoming REST request.
	 * @return array
	 */
	public static function filter_send_list_query( $args, $request ) {
		$value = $request->get_param( self::SEND_LIST_QUERY_PARAM );
		if ( null === $value || '' === $value ) {
			return $args;
		}

		$raw = is_array( $value ) ? $value : explode( ',', (string) $value );
		$ids = array_values(
			array_filter(
				array_map( 'trim', array_map( 'strval', $raw ) ),
				static function ( $v ) {
					return '' !== $v;
				}
			)
		);
		if ( empty( $ids ) ) {
			return $args;
		}

		$clause = [
			'key'     => 'send_list_id',
			'value'   => $ids,
			'compare' => 'IN',
		];

		if ( empty( $args['meta_query'] ) ) {
			$args['meta_query'] = []; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}
		$args['meta_query'][] = $clause; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query

		return $args;
	}

	/**
	 * Register the helper route that feeds the React list filter dropdowns.
	 */
	public static function register_rest_routes() {
		register_rest_route(
			'newspack-newsletters/v1',
			'/newsletters-list/filter-options',
			[
				'methods'             => 'GET',
				'callback'            => [ __CLASS__, 'rest_get_filter_options' ],
				'permission_callback' => [ __CLASS__, 'rest_filter_options_permission_check' ],
			]
		);
	}

	/**
	 * Same cap a publisher needs to see the newsletters list itself.
	 *
	 * @return bool
	 */
	public static function rest_filter_options_permission_check() {
		$cpt_object = get_post_type_object( Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT );
		if ( ! $cpt_object || empty( $cpt_object->cap->edit_posts ) ) {
			return false;
		}
		return current_user_can( $cpt_object->cap->edit_posts );
	}

	/**
	 * One-shot payload of every option list the React filter dropdowns
	 * consume. Scoped to newsletters the current user can edit, so a
	 * publisher without `edit_others_posts` only sees options derived
	 * from their own rows — mirrors what the list itself shows.
	 *
	 * @return \WP_REST_Response
	 */
	public static function rest_get_filter_options() {
		$user_scope = self::build_user_post_scope_sql();
		return rest_ensure_response(
			[
				'authors'    => self::get_authors_used( $user_scope ),
				'categories' => self::get_terms_used( 'category', $user_scope ),
				'tags'       => self::get_terms_used( 'post_tag', $user_scope ),
				'send_lists' => self::get_send_list_ids_used( $user_scope ),
			]
		);
	}

	/**
	 * SQL fragment scoping a `wp_posts p` join to rows the current user
	 * can edit — empty string for users with `edit_others_posts` (full
	 * visibility), `AND p.post_author = <id>` otherwise.
	 *
	 * @return string
	 */
	private static function build_user_post_scope_sql() {
		global $wpdb;
		$cpt_object = get_post_type_object( Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT );
		if ( $cpt_object && current_user_can( $cpt_object->cap->edit_others_posts ) ) {
			return '';
		}
		return $wpdb->prepare( ' AND p.post_author = %d', get_current_user_id() );
	}

	/**
	 * Distinct authors of any non-auto-draft newsletter in scope.
	 *
	 * @param string $user_scope_sql User-scope WHERE fragment from `build_user_post_scope_sql`.
	 * @return array<array{id: int, label: string}>
	 */
	private static function get_authors_used( $user_scope_sql = '' ) {
		global $wpdb;
		$cpt = Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		$author_ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT p.post_author
				 FROM {$wpdb->posts} p
				 WHERE p.post_type = %s
				   AND p.post_status NOT IN ( 'auto-draft' )
				   AND p.post_author <> 0" . $user_scope_sql . '
				 ORDER BY p.post_author ASC
				 LIMIT %d',
				$cpt,
				self::FILTER_OPTIONS_LIMIT
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		$options = [];
		foreach ( (array) $author_ids as $id ) {
			$user = get_userdata( (int) $id );
			if ( $user ) {
				$options[] = [
					'id'    => (int) $user->ID,
					'label' => (string) $user->display_name,
				];
			}
		}
		usort(
			$options,
			static function ( $a, $b ) {
				return strcasecmp( $a['label'], $b['label'] );
			}
		);
		return $options;
	}

	/**
	 * Distinct terms applied to any in-scope newsletter, in the given taxonomy.
	 *
	 * @param string $taxonomy       `category` or `post_tag`.
	 * @param string $user_scope_sql User-scope WHERE fragment from `build_user_post_scope_sql`.
	 * @return array<array{id: int, label: string}>
	 */
	private static function get_terms_used( $taxonomy, $user_scope_sql = '' ) {
		global $wpdb;
		$cpt = Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DISTINCT t.term_id AS id, t.name AS label
				 FROM {$wpdb->term_relationships} tr
				 INNER JOIN {$wpdb->posts} p ON p.ID = tr.object_id
				 INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
				 INNER JOIN {$wpdb->terms} t ON t.term_id = tt.term_id
				 WHERE p.post_type = %s
				   AND p.post_status NOT IN ( 'auto-draft' )
				   AND tt.taxonomy = %s" . $user_scope_sql . '
				 ORDER BY t.name ASC
				 LIMIT %d',
				$cpt,
				$taxonomy,
				self::FILTER_OPTIONS_LIMIT
			),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		return array_map(
			static function ( $row ) {
				return [
					'id'    => (int) $row['id'],
					'label' => (string) $row['label'],
				];
			},
			$rows ? $rows : []
		);
	}

	/**
	 * Distinct non-empty `send_list_id` meta values across in-scope newsletters.
	 * Friendly-name resolution is deferred (Known gaps); raw IDs ship.
	 *
	 * @param string $user_scope_sql User-scope WHERE fragment from `build_user_post_scope_sql`.
	 * @return array<array{id: string, label: string}>
	 */
	private static function get_send_list_ids_used( $user_scope_sql = '' ) {
		global $wpdb;
		$cpt = Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT pm.meta_value
				 FROM {$wpdb->postmeta} pm
				 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				 WHERE pm.meta_key = 'send_list_id'
				   AND pm.meta_value <> ''
				   AND p.post_type = %s
				   AND p.post_status NOT IN ( 'auto-draft' )" . $user_scope_sql . '
				 ORDER BY pm.meta_value ASC
				 LIMIT %d',
				$cpt,
				self::FILTER_OPTIONS_LIMIT
			)
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
		return array_map(
			static function ( $id ) {
				return [
					'id'    => (string) $id,
					'label' => (string) $id,
				];
			},
			$ids ? $ids : []
		);
	}

	/**
	 * Register REST fields on the newsletters CPT.
	 */
	public static function register_rest_fields() {
		register_rest_field(
			Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			'newspack_newsletters_status',
			[
				'get_callback' => [ __CLASS__, 'rest_get_status' ],
				'schema'       => [
					'context'    => [ 'view', 'edit' ],
					'type'       => 'object',
					'readonly'   => true,
					'properties' => [
						'kind'         => [
							'type' => 'string',
							'enum' => [ 'draft', 'sent', 'scheduled', 'trash' ],
						],
						'sent_at'      => [
							'type' => [ 'integer', 'null' ],
						],
						'scheduled_at' => [
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
	 * Matches WP's documented field-callback signature so future strict-mode
	 * runtimes and IDE tooling don't flag a mismatch:
	 * `( $object, $field_name, $request, $object_type )`. Only `$object` is
	 * used; the rest are accepted defensively.
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
	 * Compute the consolidated status payload for a newsletter post.
	 *
	 * Resolution order matters: trash takes precedence (we don't want to
	 * mask trashed-but-previously-sent items as sent), then sent (covers
	 * publish/private with the post's publish-date fallback), then
	 * scheduled (`post_status=future` or the `sending_scheduled` meta
	 * flag set during an in-flight ESP dispatch), finally draft as the
	 * catch-all.
	 *
	 * @param WP_Post|null $post Post object.
	 * @return array { kind, sent_at, scheduled_at }
	 */
	public static function get_status_for_post( $post ) {
		$payload = [
			'kind'         => 'draft',
			'sent_at'      => null,
			'scheduled_at' => null,
		];

		if ( ! $post instanceof WP_Post ) {
			return $payload;
		}

		if ( 'trash' === $post->post_status ) {
			$payload['kind'] = 'trash';
			return $payload;
		}

		$sent_at = self::compute_sent_at( $post );
		if ( null !== $sent_at ) {
			$payload['kind']    = 'sent';
			$payload['sent_at'] = $sent_at;
			return $payload;
		}

		if ( 'future' === $post->post_status ) {
			$datetime = get_post_datetime( $post, 'date', 'gmt' );
			if ( $datetime ) {
				$payload['kind']         = 'scheduled';
				$payload['scheduled_at'] = $datetime->getTimestamp();
				return $payload;
			}
		}

		if ( get_post_meta( $post->ID, 'sending_scheduled', true ) ) {
			$payload['kind'] = 'scheduled';
			return $payload;
		}

		return $payload;
	}

	/**
	 * Read-only equivalent of `Newspack_Newsletters::is_newsletter_sent` —
	 * mirrors its resolution logic exactly but never writes to `post_meta`.
	 *
	 * `is_newsletter_sent` calls `set_newsletter_sent` to back-fill the
	 * `newsletter_sent` meta whenever a published post is missing it (or
	 * has mismatched meta), so calling it from the REST GET would issue
	 * one write per row in the response. This list endpoint is read-only
	 * by contract — derive the timestamp without mutating.
	 *
	 * Resolution order matches `is_newsletter_sent`:
	 *
	 * 1. `sending_scheduled` / `scheduling_error` meta suppress sent state.
	 * 2. Compute the publish timestamp first (`0` when the post isn't
	 *    `publish` / `private`).
	 * 3. Accept `newsletter_sent` meta only when it is positive AND equals
	 *    the publish timestamp. Stale meta on a draft / scheduled row
	 *    therefore reports as "not sent", and a published row with
	 *    mismatched meta reports the publish timestamp instead of the
	 *    drifted meta value.
	 * 4. Otherwise, for `publish` / `private` rows, return the publish
	 *    timestamp.
	 * 5. Otherwise return `null`.
	 *
	 * @param WP_Post $post Post object.
	 * @return int|null Sent timestamp, or null when not (yet) sent.
	 */
	private static function compute_sent_at( $post ) {
		if ( get_post_meta( $post->ID, 'sending_scheduled', true ) ) {
			return null;
		}
		if ( get_post_meta( $post->ID, 'scheduling_error', true ) ) {
			return null;
		}

		$sent          = (int) get_post_meta( $post->ID, 'newsletter_sent', true );
		$is_published  = in_array( $post->post_status, [ 'publish', 'private' ], true );
		$post_datetime = $is_published ? get_post_datetime( $post, 'date', 'gmt' ) : false;
		$publish_date  = $post_datetime ? $post_datetime->getTimestamp() : 0;

		// Only accept `newsletter_sent` when it actually matches the
		// publish timestamp. Anything else is stale / mismatched meta
		// that `is_newsletter_sent` would otherwise overwrite — we just
		// ignore it instead.
		if ( 0 < $sent && $sent === $publish_date ) {
			return $sent;
		}

		if ( $publish_date ) {
			return $publish_date;
		}

		return null;
	}
}
Newsletters_List_REST::init();

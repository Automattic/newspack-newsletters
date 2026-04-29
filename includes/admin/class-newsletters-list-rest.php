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

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_fields' ] );
		add_filter(
			'rest_' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_query',
			[ __CLASS__, 'filter_rest_query' ],
			10,
			2
		);
		add_filter(
			'rest_' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_query',
			[ __CLASS__, 'expand_scheduled_filter' ],
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
	 * The "Scheduled" filter element value (`status=future`) only matches
	 * native WP-scheduled posts, but the Status column also renders rows
	 * with the in-flight `sending_scheduled` meta as "Scheduled" — those
	 * would otherwise disappear when the user applies the filter. When
	 * the request is asking for `future` and only `future`, widen
	 * `post_status` to the writable set (no trash) and OR in a
	 * `sending_scheduled` meta-EXISTS subquery via `posts_where`. The
	 * callback removes itself after running so it's a true one-shot.
	 *
	 * @param array            $args    Query args being assembled.
	 * @param \WP_REST_Request $request Incoming REST request.
	 * @return array
	 */
	public static function expand_scheduled_filter( $args, $request ) {
		$status = $request->get_param( 'status' );
		if ( is_array( $status ) ) {
			$values = array_map( 'strval', $status );
		} else {
			$values = '' === $status || null === $status ? [] : explode( ',', (string) $status );
		}
		$values = array_values(
			array_filter(
				array_map( 'trim', $values ),
				static function ( $v ) {
					return '' !== $v;
				}
			)
		);

		// Trigger as soon as the user's selection contains `future`. For
		// a sole-`future` request we narrow back to scheduled-only via
		// the OR clause; for mixed selections (e.g. `future,publish`)
		// we still surface in-flight scheduled rows alongside the rest.
		if ( ! in_array( 'future', $values, true ) ) {
			return $args;
		}

		$selected_statuses   = $values;
		$args['post_status'] = [ 'future', 'draft', 'pending', 'publish', 'private', 'auto-draft' ];

		$callback = static function ( $where ) use ( &$callback, $selected_statuses ) {
			global $wpdb;
			$placeholders = implode( ',', array_fill( 0, count( $selected_statuses ), '%s' ) );
			$prepare_args = array_merge( $selected_statuses, [ 'sending_scheduled' ] );
			$sql          = sprintf(
				" AND ( {$wpdb->posts}.post_status IN (%s) OR EXISTS ( SELECT 1 FROM {$wpdb->postmeta} WHERE post_id = {$wpdb->posts}.ID AND meta_key = %%s AND meta_value <> '' ) )",
				$placeholders
			);
			$where       .= $wpdb->prepare( $sql, $prepare_args ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $sql is built from a fixed list of `%s` placeholders.
			remove_filter( 'posts_where', $callback, 10 );
			return $where;
		};
		add_filter( 'posts_where', $callback, 10, 1 );

		return $args;
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

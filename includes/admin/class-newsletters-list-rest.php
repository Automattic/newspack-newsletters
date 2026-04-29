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
	 * publish/private back-filled by `is_newsletter_sent`), then scheduled
	 * (`post_status=future` or the `sending_scheduled` meta flag set during
	 * an in-flight ESP dispatch), finally draft as the catch-all.
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

		$sent = Newspack_Newsletters::is_newsletter_sent( $post->ID );
		if ( $sent ) {
			$payload['kind']    = 'sent';
			$payload['sent_at'] = (int) $sent;
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
}
Newsletters_List_REST::init();

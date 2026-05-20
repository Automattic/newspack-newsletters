<?php
/**
 * Shared scaffolding for the React lists' kind-based status filter.
 *
 * Both the newsletters and ads REST endpoints expose a `?status=`
 * filter whose values are domain-specific *kinds* (sent / scheduled /
 * draft / trash for newsletters; active / scheduled / expired / draft
 * / trash for ads) — not raw `post_status` values. Each kind expands
 * into its own bucket: a widened `post_status` set plus a SQL
 * fragment that ORs into `posts_where` to filter rows to that kind's
 * exact definition.
 *
 * This trait collapses the two pieces of scaffolding both endpoints
 * re-implemented: input parsing (`?status=` accepts a comma-string
 * or array) and the token-scoped, self-removing `posts_where`
 * closure that ORs the bucket SQL clauses. The kind→clause mapping
 * itself stays in each consumer — it's domain-specific (newsletters
 * keys off `sending_scheduled`/`scheduling_error` meta; ads keys off
 * `start_date`/`expiry_date`) and there's no clean shared shape.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Token-scoped bucket-filter builder used by the list-page REST
 * status filters.
 */
trait Status_Filter_Builder {
	/**
	 * Parse a `?status=` value (string or array) into a deduplicated,
	 * trimmed list of non-empty kinds. Whitespace and empty entries
	 * are dropped; numeric and string inputs are coerced to strings.
	 *
	 * @param mixed $value Raw param value.
	 * @return string[]
	 */
	protected static function parse_status_values( $value ) {
		if ( null === $value || '' === $value ) {
			return [];
		}
		$raw = is_array( $value ) ? $value : explode( ',', (string) $value );
		return array_values(
			array_unique(
				array_filter(
					array_map( 'trim', array_map( 'strval', $raw ) ),
					static function ( $v ) {
						return '' !== $v;
					}
				)
			)
		);
	}

	/**
	 * Install a token-scoped, self-removing `posts_where` closure that
	 * ORs the given bucket SQL clauses into the WHERE.
	 *
	 * Each clause must be a complete, self-contained boolean
	 * expression (already prepared via `$wpdb->prepare()` if it
	 * embeds untrusted values). The closure self-removes after firing
	 * once for the matching query — token-scoping prevents nested
	 * `WP_Query` invocations from consuming the filter early.
	 *
	 * Caller stores the token under a unique key on `$args` so the
	 * closure can recognise the intended query (`$wp_query->get($key)`);
	 * the same `$args` is then handed back to WP_Query unchanged.
	 *
	 * @param array    $args           Query args being assembled.
	 * @param string[] $bucket_clauses Already-prepared SQL clauses to OR.
	 * @param string   $token_key      Query-args key that scopes the closure
	 *                                 to the intended `WP_Query`.
	 * @return array Modified args (with `$token_key` set).
	 */
	protected static function install_bucket_filter( array $args, array $bucket_clauses, $token_key ) {
		if ( empty( $bucket_clauses ) ) {
			return $args;
		}

		$token              = uniqid( $token_key . '_', true );
		$args[ $token_key ] = $token;

		$callback = static function ( $where, $wp_query ) use ( &$callback, $token, $token_key, $bucket_clauses ) {
			if ( ! is_object( $wp_query ) || $wp_query->get( $token_key ) !== $token ) {
				return $where;
			}
			$where .= ' AND ( ' . implode( ' OR ', $bucket_clauses ) . ' )';
			remove_filter( 'posts_where', $callback, 10 );
			return $where;
		};
		add_filter( 'posts_where', $callback, 10, 2 );

		return $args;
	}
}

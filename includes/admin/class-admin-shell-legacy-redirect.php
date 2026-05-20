<?php
/**
 * Admin shell — legacy CPT list redirect.
 *
 * Owns the `current_screen` hook that 302s the classic
 * `edit.php?post_type=…` URLs through to their React replacements,
 * and the helper that builds the redirect target.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Classic CPT list → React page redirect plumbing.
 */
class Admin_Shell_Legacy_Redirect {
	/**
	 * Query args we forward from the legacy URL onto the React page so the
	 * JS side can seed initial view state. `paged` is deliberately
	 * omitted — the legacy WP list table uses 20 items per page while the
	 * DataView defaults to 25, so a `paged=N` carry-over would point at
	 * the wrong slice anyway. Stick to filter / search / sort args that
	 * map cleanly onto DataViews state.
	 */
	const FORWARDED_LEGACY_ARGS = [
		'post_status',
		's',
		'orderby',
		'order',
		'author',
		'categories',
		'tags',
		'newspack_newsletters_send_list_id',
	];

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'current_screen', [ __CLASS__, 'maybe_redirect_legacy_list' ] );
	}

	/**
	 * Are any of the bulk-action selectors set to a real value (i.e. not
	 * the `-1` "no action selected" sentinel WP submits when the user
	 * leaves the dropdown alone)? Both `action` (top-of-table dropdown)
	 * and `action2` (bottom-of-table dropdown) are checked.
	 *
	 * @return bool
	 */
	private static function has_real_get_action() {
		foreach ( [ 'action', 'action2' ] as $key ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only nav check.
			if ( ! isset( $_GET[ $key ] ) ) {
				continue;
			}
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only nav check.
			$value = sanitize_text_field( wp_unslash( $_GET[ $key ] ) );
			if ( '' !== $value && '-1' !== $value ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Redirect legacy CPT list GET requests (deep links, browser
	 * history, third-party menu links) to the matching React page.
	 * Each chassis page declares its legacy screen id and redirect
	 * target — this handler iterates pages and lets the matching one
	 * supply the destination. Form-submission GETs that carry
	 * `?action=` are left alone so classic admin flows continue to
	 * work. Filter / search / sort args are forwarded so the React
	 * page can pre-fill view state — see `getInitialView` on the JS
	 * side.
	 *
	 * @param \WP_Screen $screen Current screen.
	 */
	public static function maybe_redirect_legacy_list( $screen ) {
		if ( ! is_admin() || ! $screen instanceof \WP_Screen ) {
			return;
		}
		if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || 'GET' !== $_SERVER['REQUEST_METHOD'] ) {
			return;
		}

		$matching_page = null;
		foreach ( Admin_Shell::get_pages() as $page ) {
			if ( $screen->id === $page->get_legacy_screen_id() ) {
				$matching_page = $page;
				break;
			}
		}
		if ( ! $matching_page ) {
			return;
		}

		// `action=-1` (and the bottom dropdown's `action2=-1`) is WP's
		// "no bulk action selected" sentinel — typically left in the URL
		// after the user submits the bulk-actions form without picking
		// one. Treat it as a no-op so those stale URLs still redirect to
		// the React page; only bypass for real action values.
		if ( self::has_real_get_action() ) {
			return;
		}

		$forwarded = [];
		foreach ( self::FORWARDED_LEGACY_ARGS as $key ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only nav check.
			if ( ! isset( $_GET[ $key ] ) ) {
				continue;
			}
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended,WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitised below.
			$value = wp_unslash( $_GET[ $key ] );
			if ( '' === $value ) {
				continue;
			}
			$forwarded[ $key ] = is_array( $value ) ? array_map( 'sanitize_text_field', $value ) : sanitize_text_field( $value );
		}

		$target = $matching_page->get_legacy_redirect_target( $forwarded );
		if ( ! $target ) {
			return;
		}

		wp_safe_redirect( $target );
		exit;
	}

	/**
	 * Build a redirect target URL for a chassis-managed page.
	 * Centralises the `?post_type=…&page=…&<forwarded>` shape so each
	 * page only has to hand over its CPT slug + page slug.
	 *
	 * @param string       $post_type CPT slug the page shadows.
	 * @param string       $page_slug The React page's `?page=` slug.
	 * @param array|string $forwarded Forwarded query args, or a `post_status` string.
	 * @return string
	 */
	public static function build_legacy_redirect_target( $post_type, $page_slug, $forwarded = [] ) {
		$args = [
			'post_type' => $post_type,
			'page'      => $page_slug,
		];

		if ( is_string( $forwarded ) ) {
			$forwarded = '' === $forwarded ? [] : [ 'post_status' => $forwarded ];
		}

		foreach ( self::FORWARDED_LEGACY_ARGS as $key ) {
			if ( ! empty( $forwarded[ $key ] ) ) {
				$args[ $key ] = $forwarded[ $key ];
			}
		}

		return add_query_arg( $args, admin_url( 'edit.php' ) );
	}
}

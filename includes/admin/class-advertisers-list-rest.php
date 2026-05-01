<?php
/**
 * REST surface for the Newsletter Advertisers list DataView.
 *
 * The Advertiser taxonomy is registered with `show_in_rest => true`, so
 * the standard `/wp/v2/newspack_nl_advertiser` collection endpoint
 * handles list/create/read/update/delete out of the box. This class adds
 * the validation rails the React DataView needs on top of those defaults.
 *
 * Currently:
 *
 *  - Reject `parent === self` on term updates. WP enforces parent != self
 *    for `wp_insert_term` (the new term doesn't exist yet to be self-
 *    referencing) but not for `wp_update_term`, so a PATCH that sets
 *    `parent` to the term's own id would silently persist a self-loop
 *    that breaks the React TreeSelect.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

use Newspack_Newsletters\Ads;
use WP_Error;
use WP_REST_Request;

/**
 * Validation rails for the Advertiser taxonomy REST endpoints.
 */
class Advertisers_List_REST {
	/**
	 * Boot hooks.
	 *
	 * The natural surface — `rest_pre_insert_<taxonomy>` — is unusable
	 * here: `WP_REST_Terms_Controller::update_item` does not call
	 * `is_wp_error()` on the value `prepare_item_for_database()` returns,
	 * so a WP_Error from that filter is cast to an array and silently
	 * discarded. `wp_update_term` itself does not fire `pre_insert_term`
	 * (it only fires in `wp_insert_term`), and `wp_update_term_parent`
	 * expects an integer return (no error path). The remaining clean
	 * surface is `rest_request_before_callbacks`, which fires after
	 * routing (so `$request['id']` is populated) and before the
	 * controller callback runs — returning WP_Error there short-circuits
	 * the dispatch and becomes the response.
	 */
	public static function init() {
		add_filter( 'rest_request_before_callbacks', [ __CLASS__, 'guard_parent_self' ], 10, 3 );
	}

	/**
	 * Block term updates whose `parent` equals the term's own id.
	 *
	 * Scoped to update-shaped requests against the advertiser taxonomy:
	 * the route is `/wp/v2/<taxonomy>/<id>` and the method is one of
	 * POST/PUT/PATCH (the WP terms controller registers all three on the
	 * editable methods constant).
	 *
	 * @param mixed           $response Result of any earlier filter (passed through unless we override).
	 * @param array           $handler  Route handler details (callback, permission_callback, methods, args, …).
	 * @param WP_REST_Request $request  Incoming REST request.
	 * @return mixed
	 */
	public static function guard_parent_self( $response, $handler, $request ) {
		unset( $handler );

		// An earlier callback on this filter may have already short-
		// circuited the dispatch (permission check, another guard, etc.).
		// Bail before any further work so a non-null `$response` is
		// passed through unchanged — overwriting it with a WP_Error
		// from this guard would mask the earlier signal.
		if ( null !== $response ) {
			return $response;
		}

		if ( ! $request instanceof WP_REST_Request ) {
			return $response;
		}

		// Scope to single-term update endpoints on the advertiser
		// taxonomy: `/wp/v2/<taxonomy>/<id>`. The route path drives the
		// gate; the `id` and `parent` values are read from the request
		// params directly via ArrayAccess (`$request['id']` /
		// `$request->get_param( 'parent' )`) so the guard doesn't depend
		// on whatever `get_route()` happens to return — that's currently
		// the URL, but using params keeps the implementation robust if
		// WP ever swaps in the matched route pattern.
		$route   = $request->get_route();
		$pattern = '#^/wp/v2/' . preg_quote( Ads::ADVERTISER_TAX, '#' ) . '/\d+$#';
		if ( ! preg_match( $pattern, $route ) ) {
			return $response;
		}

		$method = $request->get_method();
		if ( ! in_array( $method, [ 'POST', 'PUT', 'PATCH' ], true ) ) {
			return $response;
		}

		$term_id = isset( $request['id'] ) ? (int) $request['id'] : 0;
		$parent  = $request->get_param( 'parent' );

		if ( null === $parent ) {
			return $response;
		}

		$parent = (int) $parent;
		if ( $term_id > 0 && $parent > 0 && $parent === $term_id ) {
			return new WP_Error(
				'newspack_newsletters_advertiser_parent_self',
				__( 'An advertiser cannot be its own parent.', 'newspack-newsletters' ),
				[ 'status' => 400 ]
			);
		}

		return $response;
	}
}

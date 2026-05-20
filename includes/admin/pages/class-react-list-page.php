<?php
/**
 * Abstract React list-page base.
 *
 * Shared scaffold for the React DataView pages that shadow a classic
 * `edit.php?post_type=…` or `edit-tags.php?taxonomy=…` screen. The
 * subclass provides the post_type used in the React page URL via
 * `get_redirect_post_type()`; this base wires the corresponding
 * legacy-list redirect through
 * `Admin_Shell_Legacy_Redirect::build_legacy_redirect_target`.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;
use Newspack\Newsletters\Admin\Admin_Shell_Legacy_Redirect;

defined( 'ABSPATH' ) || exit;

/**
 * Base for admin list pages backed by a React shell.
 */
abstract class React_List_Page extends Admin_Page {
	/**
	 * `post_type` slug the React page lives under in the admin URL:
	 * `edit.php?post_type=<this>&page=<slug>`. Used by the legacy-list
	 * redirect to build the canonical React URL.
	 *
	 * @return string
	 */
	abstract public function get_redirect_post_type();

	/**
	 * Default redirect: hand the page's CPT slug + own slug to the
	 * shared helper. Subclasses can still override for non-standard
	 * targets.
	 *
	 * @param array $forwarded Forwarded query args.
	 * @return string
	 */
	public function get_legacy_redirect_target( $forwarded = [] ) {
		return Admin_Shell_Legacy_Redirect::build_legacy_redirect_target(
			$this->get_redirect_post_type(),
			$this->slug,
			$forwarded
		);
	}
}

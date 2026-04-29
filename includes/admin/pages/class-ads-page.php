<?php
/**
 * Newsletter ads admin page.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;

defined( 'ABSPATH' ) || exit;

/**
 * Newsletter ads list page (replaces classic CPT table — see NEWS-1930).
 */
class Ads_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-ads';

	/**
	 * Get the page label.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'Ads', 'newspack-newsletters' );
	}
}

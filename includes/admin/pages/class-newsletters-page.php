<?php
/**
 * Newsletters list admin page.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;

defined( 'ABSPATH' ) || exit;

/**
 * Newsletters list page (replaces classic CPT table — see NEWS-1928).
 */
class Newsletters_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters';

	/**
	 * Get the page label.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'Newsletters', 'newspack-newsletters' );
	}
}

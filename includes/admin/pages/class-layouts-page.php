<?php
/**
 * Layouts admin page.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;

defined( 'ABSPATH' ) || exit;

/**
 * Layouts management page (replaces classic CPT table — see NEWS-1929).
 */
class Layouts_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-layouts';

	/**
	 * Get the page label.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'Layouts', 'newspack-newsletters' );
	}
}

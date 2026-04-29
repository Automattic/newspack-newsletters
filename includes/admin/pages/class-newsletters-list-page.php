<?php
/**
 * Newsletters list admin page (React DataView).
 *
 * Replaces the classic WP_List_Table for the newsletters CPT in both
 * standalone and bundled modes. The slug deliberately lives under the
 * existing CPT menu so the menu structure is preserved.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;

defined( 'ABSPATH' ) || exit;

/**
 * "All Newsletters" page — registered in both modes (NEWS-1928).
 */
class Newsletters_List_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-list';

	/**
	 * Get the page label.
	 *
	 * Matches the auto-generated CPT submenu label so the menu reads
	 * identically before and after the swap.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'All Newsletters', 'newspack-newsletters' );
	}
}

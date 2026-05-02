<?php
/**
 * Settings admin page (standalone mode only).
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;

defined( 'ABSPATH' ) || exit;

/**
 * Settings page — only registered in standalone mode.
 */
class Settings_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-settings';

	/**
	 * ESP credentials and global settings stay admin-only.
	 *
	 * @var string
	 */
	protected $capability = 'manage_options';

	/**
	 * Get the page label.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'Settings', 'newspack-newsletters' );
	}

	/**
	 * Settings is visible in the menu under the Newsletters CPT — this is
	 * what gives standalone mode an entry point at all (in bundled mode
	 * `Admin_Shell::get_pages()` doesn't include it).
	 *
	 * @return string
	 */
	public function get_parent_slug() {
		return 'edit.php?post_type=' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}
}

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
 * Settings page — only registered in standalone mode (see NEWS-1931).
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
}

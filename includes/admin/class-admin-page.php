<?php
/**
 * Base class for React-based admin pages.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Abstract base for an admin page that mounts a React app.
 */
abstract class Admin_Page {
	/**
	 * Page slug. Override in subclasses.
	 *
	 * @var string
	 */
	protected $slug = '';

	/**
	 * Capability required to view the page.
	 *
	 * @var string
	 */
	protected $capability = 'manage_options';

	/**
	 * Get the page slug.
	 *
	 * @return string
	 */
	public function get_slug() {
		return $this->slug;
	}

	/**
	 * Get the page label shown in the admin menu.
	 *
	 * @return string
	 */
	abstract public function get_label();

	/**
	 * Get the capability required to view the page.
	 *
	 * @return string
	 */
	public function get_capability() {
		return $this->capability;
	}

	/**
	 * Whether the current request is for this admin page.
	 *
	 * @return bool
	 */
	public function is_admin_page() {
		if ( ! isset( $_GET['page'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return false;
		}
		return $this->slug === sanitize_text_field( wp_unslash( $_GET['page'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * DOM id used as the React mount node.
	 *
	 * @return string
	 */
	public function get_mount_id() {
		return $this->slug . '-root';
	}

	/**
	 * Render the React mount container.
	 */
	public function render() {
		printf(
			'<div id="%s" class="newspack-newsletters-admin-mount"></div>',
			esc_attr( $this->get_mount_id() )
		);
	}
}

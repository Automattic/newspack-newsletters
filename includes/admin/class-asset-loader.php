<?php
/**
 * Asset enqueue helper.
 *
 * Centralises the script + style enqueue sequence used by admin-side
 * React bundles built via `@wordpress/scripts` — each bundle emits a
 * sibling `<handle>.asset.php` carrying the runtime dependency array
 * and a content-hash version. Callers compose URLs and pass any
 * extra dependencies; the helper handles the file_exists guard, the
 * asset.php require, and the two enqueue calls.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Shared `<handle>.asset.php` + script + style enqueue helper.
 */
class Asset_Loader {
	/**
	 * Read `<build_dir>/<handle>.asset.php` and enqueue the matching
	 * `<handle>.js` (always) and `<handle>.css` (when present) under
	 * the given handle.
	 *
	 * @param string $handle            Script + style handle.
	 * @param string $build_dir         Filesystem path to the dist
	 *                                  directory containing the
	 *                                  asset.php / .js / .css files.
	 * @param string $url_dir           Public URL prefix matching
	 *                                  `$build_dir`.
	 * @param array  $extra_script_deps Additional handles to merge
	 *                                  into the script dependency
	 *                                  array declared in asset.php.
	 * @param array  $extra_style_deps  Dependencies for the matching
	 *                                  `.css` enqueue.
	 * @return array|null Asset metadata (`dependencies`, `version`)
	 *                    on success, null when `asset.php` is missing.
	 */
	public static function enqueue_bundle(
		$handle,
		$build_dir,
		$url_dir,
		$extra_script_deps = [],
		$extra_style_deps = []
	) {
		$asset_path = trailingslashit( $build_dir ) . $handle . '.asset.php';
		if ( ! file_exists( $asset_path ) ) {
			return null;
		}
		$asset = require $asset_path;

		$script_deps = array_values(
			array_unique( array_merge( $asset['dependencies'], $extra_script_deps ) )
		);

		wp_enqueue_script(
			$handle,
			trailingslashit( $url_dir ) . $handle . '.js',
			$script_deps,
			$asset['version'],
			true
		);

		$style_path = trailingslashit( $build_dir ) . $handle . '.css';
		if ( file_exists( $style_path ) ) {
			wp_enqueue_style(
				$handle,
				trailingslashit( $url_dir ) . $handle . '.css',
				$extra_style_deps,
				$asset['version']
			);
		}

		return $asset;
	}
}

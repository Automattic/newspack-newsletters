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
	 * Read `<build_dir>/<basename>.asset.php` and enqueue the matching
	 * `<basename>.js` (always) and `<basename>.css` (when present)
	 * under the given handle.
	 *
	 * The WP handle and the on-disk file stem are independent — webpack
	 * emits bundles under the entry key (e.g. `admin-shell`) while WP
	 * conventionally uses a plugin-prefixed handle (e.g.
	 * `newspack-newsletters-admin-shell`). Conflating them was a P1
	 * regression in the helper's first cut.
	 *
	 * @param string $handle            WP script + style handle.
	 * @param string $basename          File stem (no extension) matching
	 *                                  the webpack entry — used for the
	 *                                  `<basename>.asset.php`, `.js`, and
	 *                                  `.css` lookups.
	 * @param string $build_dir         Filesystem path to the dist
	 *                                  directory.
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
		$basename,
		$build_dir,
		$url_dir,
		$extra_script_deps = [],
		$extra_style_deps = []
	) {
		$asset_path = trailingslashit( $build_dir ) . $basename . '.asset.php';
		if ( ! file_exists( $asset_path ) ) {
			return null;
		}
		$asset = require $asset_path;

		$script_deps = array_values(
			array_unique( array_merge( $asset['dependencies'], $extra_script_deps ) )
		);

		wp_enqueue_script(
			$handle,
			trailingslashit( $url_dir ) . $basename . '.js',
			$script_deps,
			$asset['version'],
			true
		);

		$style_path = trailingslashit( $build_dir ) . $basename . '.css';
		if ( file_exists( $style_path ) ) {
			wp_enqueue_style(
				$handle,
				trailingslashit( $url_dir ) . $basename . '.css',
				$extra_style_deps,
				$asset['version']
			);
		}

		return $asset;
	}
}

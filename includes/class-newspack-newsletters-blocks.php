<?php
/**
 * Newspack Newsletters Blocks.
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Newspack Blocks Class.
 */
final class Newspack_Newsletters_Blocks {
	/**
	 * Initialize Hooks.
	 */
	public static function init() {
		require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/src/blocks/subscribe/index.php';
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'enqueue_block_editor_assets' ] );
	}

	/**
	 * Enqueue blocks scripts and styles for editor.
	 */
	public static function enqueue_block_editor_assets() {
		$handle = 'newspack-newsletters-blocks';
		wp_enqueue_script(
			$handle,
			plugins_url( '../dist/blocks.js', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/blocks.js' ),
			true
		);
		wp_localize_script(
			$handle,
			'newspack_newsletters_blocks',
			[
				'settings_url' => Newspack_Newsletters_Settings::get_settings_url(),
			]
		);
		wp_enqueue_style(
			$handle,
			plugins_url( '../dist/blocks.css', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/blocks.css' )
		);
	}
}
Newspack_Newsletters_Blocks::init();

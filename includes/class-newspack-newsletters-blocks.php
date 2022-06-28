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
		wp_enqueue_script(
			'newspack-newsletters-blocks',
			plugins_url( '../dist/blocks.js', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/blocks.js' ),
			true
		);
		wp_enqueue_style(
			'newspack-newsletters-blocks',
			plugins_url( '../dist/blocks.js', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/blocks.js' )
		);
	}
}
Newspack_Newsletters_Blocks::init();

<?php
/**
 * Register newsletter templates.
 *
 * @package Newspack_Newsletters
 */

add_filter(
	'newspack_newsletters_templates',
	function( $templates ) {
 		$decode  = json_decode( file_get_contents( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'src/templates/blank.json'), true ); //phpcs:ignore
		$content     = $decode['content'];
		$templates[] = [
			'content' => $content,
			'title'   => __( 'Blank', 'newspack-newsletters' ),
		];
		return $templates;
	},
	10,
	2
);

add_filter(
	'newspack_newsletters_templates',
	function( $templates ) {
 		$decode      = json_decode( file_get_contents( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'src/templates/one-column-main-story.json'), true ); //phpcs:ignore
		$content     = Newspack_Newsletters::template_token_replacement( $decode['content'] );
		$templates[] = [
			'content' => $content,
			'title'   => __( 'One Column (main story)', 'newspack-newsletters' ),
		];
		return $templates;
	},
	10,
	2
);

add_filter(
	'newspack_newsletters_templates',
	function( $templates ) {
 		$decode      = json_decode( file_get_contents( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'src/templates/one-column-no-image.json'), true ); //phpcs:ignore
		$content     = Newspack_Newsletters::template_token_replacement( $decode['content'] );
		$templates[] = [
			'content' => $content,
			'title'   => __( 'One Column (no image)', 'newspack-newsletters' ),
		];
		return $templates;
	},
	10,
	2
);

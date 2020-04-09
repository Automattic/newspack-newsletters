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
		$decode  = json_decode( file_get_contents( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'src/templates/template-1.json'), true ); //phpcs:ignore
		$content = $decode['content'];

		$custom_logo_id = get_theme_mod( 'custom_logo' );
		$logo           = wp_get_attachment_image( $custom_logo_id, 'full' );

		$sitename = get_bloginfo( 'name' );
		$content  = str_replace(
			[
				'__SITENAME__',
				'__LOGO__',
			],
			[
				$sitename,
				$logo,
			],
			$content
		);

		$templates[] = [
			'content' => $content,
			'title'   => __( 'Template 1', 'newspack-newsletters' ),
		];
		return $templates;
	},
	10,
	2
);

add_filter(
	'newspack_newsletters_templates',
	function( $templates ) {
 		$decode  = json_decode( file_get_contents( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'src/templates/template-2.json'), true ); //phpcs:ignore
		$content     = $decode['content'];
		$templates[] = [
			'content' => $content,
			'title'   => __( 'Template 2', 'newspack-newsletters' ),
		];
		return $templates;
	},
	10,
	2
);

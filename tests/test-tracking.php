<?php
/**
 * Test Tracking.
 *
 * @package Newspack_Newsletters
 */

use Newspack_Newsletters\Tracking\Pixel;
use Newspack_Newsletters\Tracking\Click;

/**
 * Newsletters Tracking Test.
 */
class Newsletters_Tracking_Test extends WP_UnitTestCase {
	/**
	 * Test tracking pixel.
	 */
	public function test_tracking_pixel() {
		$post_id = $this->factory->post->create( [ 'post_type' => \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT ] );
		$post    = \get_post( $post_id );
		ob_start();
		do_action( 'newspack_newsletters_editor_mjml_body', $post );
		$mjml_body = ob_get_clean();
		$this->assertMatchesRegularExpression( '/\/np-newsletters.pixel.php\?id=' . $post_id . '/', $mjml_body );

		// Fetch the tracking pixel URL from body.
		$pattern = '/src="([^"]*np-newsletters-pixel.php[^"]*)"/i';
		$matches = [];
		preg_match( $pattern, $mjml_body, $matches );
		$pixel_url  = html_entity_decode( $matches[1] );
		$parsed_url = \wp_parse_url( $pixel_url );
		$args       = \wp_parse_args( $parsed_url['query'] );

		$this->assertEquals( $post_id, intval( $args['id'] ) );
		$this->assertEquals( get_post_meta( $post_id, 'tracking_id', true ), $args['tid'] );
		$this->assertArrayHasKey( 'em', $args );

		// Call the tracking pixel.
		Pixel::track_seen( $args['id'], $args['tid'], 'fake@email.com' );

		// Assert seen once.
		$seen = \get_post_meta( $post_id, 'tracking_pixel_seen', true );
		$this->assertEquals( 1, $seen );

		// Call the tracking pixel again.
		Pixel::track_seen( $args['id'], $args['tid'], 'fake@email.com' );

		// Assert seen twice.
		$seen = \get_post_meta( $post_id, 'tracking_pixel_seen', true );
		$this->assertEquals( 2, $seen );
	}

	/**
	 * Test tracking click.
	 */
	public function test_tracking_click() {
		$destination_url = 'https://example.com/path?query=string&another=param&utm_medium=email#hash';

		$post_id  = $this->factory->post->create(
			[
				'post_type'    => \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				'post_title'   => 'A newsletter with link.',
				'post_content' => "<!-- wp:paragraph -->\n<p><a href=\"$destination_url\">Link</a><\/p>\n<!-- \/wp:paragraph -->",
			]
		);
		$post     = \get_post( $post_id );
		$rendered = Newspack_Newsletters_Renderer::post_to_mjml_components( $post );

		// Fetch the link URL from body.
		$pattern = '/href="([^"]*)"/i';
		$matches = [];
		preg_match( $pattern, $rendered, $matches );
		$link_url   = $matches[1];
		$parsed_url = \wp_parse_url( $link_url );
		$args       = \wp_parse_args( $parsed_url['query'] );

		$this->assertEquals( $post_id, intval( $args['id'] ) );
		$this->assertArrayHasKey( 'em', $args );

		$processed_destination_url = \wp_parse_url( $args['url'] );
		$this->assertEquals( 'https', $processed_destination_url['scheme'] );
		$this->assertEquals( 'example.com', $processed_destination_url['host'] );
		$this->assertEquals( '/path', $processed_destination_url['path'] );
		$this->assertEquals( 'query=string&another=param&utm_medium=email', $processed_destination_url['query'] );
		$this->assertEquals( 'hash', $processed_destination_url['fragment'] );

		// Manually track the click.
		Click::track_click( $args['id'], 'fake@email.com', $args['url'] );

		// Assert clicked once.
		$clicks = \get_post_meta( $post_id, 'tracking_clicks', true );
		$this->assertEquals( 1, $clicks );

		// Manually track the click again.
		Click::track_click( $args['id'], 'fake@email.com', $args['url'] );

		// Assert clicked twice.
		$clicks = \get_post_meta( $post_id, 'tracking_clicks', true );
		$this->assertEquals( 2, $clicks );
	}
}

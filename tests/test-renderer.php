<?php
/**
 * Class Newsletters Renderer Test
 *
 * @package Newspack_Newsletters
 */

/**
 * Newsletters Renderer Test.
 */
class Newsletters_Renderer_Test extends WP_UnitTestCase {

	/**
	 * Test the MJML rendering function.
	 */
	public function test_render_mjml_component() {
		$inner_html                                   = '<p>Hello, Newspack!</p>\n';
		Newspack_Newsletters_Renderer::$color_palette = [
			'vivid-purple' => '#db18e6',
		];

		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'   => 'core/paragraph',
					'attrs'       => [],
					'innerBlocks' => [],
					'innerHTML'   => $inner_html,
				]
			),
			'<mj-section padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.5" font-size="16px" >' . $inner_html . '</mj-text></mj-column></mj-section>',
			'Renders default paragraph'
		);

		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'   => 'core/paragraph',
					'attrs'       => [
						'textColor' => 'vivid-purple',
						'fontSize'  => 'normal',
						'style'     => [
							'color' => [
								'background' => '#4aadd7',
							],
						],
					],
					'innerBlocks' => [],
					'innerHTML'   => $inner_html,
				]
			),
			'<mj-section textColor="vivid-purple" color="#db18e6 !important" background-color="#4aadd7 !important" font-size="16px" padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.5" font-size="16px"  textColor="vivid-purple" color="#db18e6 !important" container-background-color="#4aadd7 !important">' . $inner_html . '</mj-text></mj-column></mj-section>',
			'Renders styled paragraph'
		);
	}

	/**
	 * Test embed blocks rendering.
	 */
	public function test_render_embed_blocks() {
		// Video embed.
		$inner_html = '<figure><div>https://www.youtube.com/watch?v=aIRgcb3cQ1Q</div></figure>';
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'   => 'core/embed',
					'attrs'       => [
						'url' => 'https://www.youtube.com/watch?v=aIRgcb3cQ1Q',
					],
					'innerBlocks' => [],
					'innerHTML'   => $inner_html,
				]
			),
			'<mj-section url="https://www.youtube.com/watch?v=aIRgcb3cQ1Q" padding="0"><mj-column padding="12px" width="100%"><mj-image padding="0" src="https://i.ytimg.com/vi/aIRgcb3cQ1Q/hqdefault.jpg" width="480px" height="360px" href="https://www.youtube.com/watch?v=aIRgcb3cQ1Q" /><mj-text align="center" color="#555d66" line-height="1.56" font-size="13px" >How to use the Newspack Newsletter plugin - YouTube</mj-text></mj-column></mj-section>',
			'Renders image from video embed block with title as caption'
		);

		// Image with custom caption.
		$inner_html = '<figure><div>https://flickr.com/photos/thomashawk/9274246246</div><figcaption>Automattic</figcaption></figure>';
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'   => 'core/embed',
					'attrs'       => [
						'url' => 'https://flickr.com/photos/thomashawk/9274246246',
					],
					'innerBlocks' => [],
					'innerHTML'   => $inner_html,
				]
			),
			'<mj-section url="https://flickr.com/photos/thomashawk/9274246246" padding="0"><mj-column padding="12px" width="100%"><mj-image src="https://live.staticflickr.com/7357/9274246246_201d71cf9a.jpg" alt="Automattic" width="500" height="333" href="https://flickr.com/photos/thomashawk/9274246246" /><mj-text align="center" color="#555d66" line-height="1.56" font-size="13px" >Automattic - Flickr</mj-text></mj-column></mj-section>',
			'Renders image with inline figcaption as caption'
		);

		// Rich embed as HTML.
		$inner_html = '<figure><div>https://twitter.com/automattic/status/1395447061336711181</div></figure>';
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'   => 'core/embed',
					'attrs'       => [
						'url' => 'https://twitter.com/automattic/status/1395447061336711181',
					],
					'innerBlocks' => [],
					'innerHTML'   => $inner_html,
				]
			),
			"<mj-section url=\"https://twitter.com/automattic/status/1395447061336711181\" padding=\"0\"><mj-column padding=\"12px\" width=\"100%\"><mj-text padding=\"0\" line-height=\"1.5\" font-size=\"16px\" ><blockquote>We&#039;re Hiring! We are continuing to grow and have some exciting open positions available, including in Engineering, Product, Marketing, Business Development, HR, Customer Support, and more. Work with us, from anywhere. <a href=\"https://t.co/EZST4WBsy2\">https://t.co/EZST4WBsy2</a> <a href=\"https://t.co/z8bKfCgn14\">pic.twitter.com/z8bKfCgn14</a>&mdash; Automattic (@automattic) <a href=\"https://twitter.com/automattic/status/1395447061336711181?ref_src=twsrc%5Etfw\">May 20, 2021</a></blockquote>\n\n</mj-text></mj-column></mj-section>",
			'Renders tweet as HTML'
		);

		// Rich embed as link.
		$inner_html = '<figure><div>https://www.amazon.com/Learning-PHP-MySQL-JavaScript-Javascript/dp/1491978910</div></figure>';
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'   => 'core/embed',
					'attrs'       => [
						'url' => 'https://www.amazon.com/Learning-PHP-MySQL-JavaScript-Javascript/dp/1491978910',
					],
					'innerBlocks' => [],
					'innerHTML'   => $inner_html,
				]
			),
			'<mj-section url="https://www.amazon.com/Learning-PHP-MySQL-JavaScript-Javascript/dp/1491978910" padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.5" font-size="16px" ><a href="https://www.amazon.com/Learning-PHP-MySQL-JavaScript-Javascript/dp/1491978910">Learning PHP, MySQL &amp; JavaScript: With jQuery, CSS &amp; HTML5 (Learning PHP, MYSQL, Javascript, CSS &amp; HTML5)</a></mj-text></mj-column></mj-section>',
			'Renders invalid rich HTML as link'
		);
	}

	/**
	 * Test other rendering-related function.
	 */
	public function test_aux_functions() {
		$this->assertEquals(
			Newspack_Newsletters_Renderer::process_links( '<a href="//newspack.pub">linky<a>' ),
			'<a href="//newspack.pub?utm_medium=email">linky<a>',
			'Appends utm_medium=email to links'
		);
		$this->assertEquals(
			Newspack_Newsletters_Renderer::process_links( '<a href="//newspack.pub?value=1">linky<a>' ),
			'<a href="//newspack.pub?value=1&utm_medium=email">linky<a>',
			'Appends utm_medium=email to links with params'
		);
	}

	/**
	 * Rendering a reusable block component.
	 */
	public function test_reusable_block() {
		$reusable_block_post_id = self::factory()->post->create(
			[
				'post_type'    => 'wp_block',
				'post_title'   => 'Reusable block.',
				'post_content' => "<!-- wp:paragraph -->\n<p>Hello<\/p>\n<!-- \/wp:paragraph -->",
			]
		);
		$newsletter_post        = self::factory()->post->create(
			[
				'post_type'    => Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				'post_title'   => 'A newsletter with a reusable block in it.',
				'post_content' => '<!-- wp:block {"ref":' . $reusable_block_post_id . '} /-->',
			]
		);
		$this->assertEquals(
			Newspack_Newsletters_Renderer::post_to_mjml_components(
				get_post( $newsletter_post )
			),
			"<mj-wrapper ref=\"$reusable_block_post_id\"><mj-section padding=\"0\"><mj-column padding=\"12px\" width=\"100%\"><mj-text padding=\"0\" line-height=\"1.5\" font-size=\"16px\" >\n<p>Hello</p>\n</mj-text></mj-column></mj-section></mj-wrapper>",
			'Renders the reusable block into valid markup'
		);
	}

	/**
	 * Rendering with custom CSS.
	 */
	public function test_custom_css() {
		$custom_css_str  = 'p { color: pink; }';
		$newsletter_post = self::factory()->post->create(
			[
				'post_type'    => Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
				'post_title'   => 'A newsletter with custom CSS.',
				'post_content' => "<!-- wp:paragraph -->\n<p>A paragraph with some custom CSS applied.<\/p>\n<!-- \/wp:paragraph -->",
			]
		);
		$post_object     = get_post( $newsletter_post );

		// Add the custom CSS.
		update_post_meta( $post_object->ID, 'custom_css', $custom_css_str );

		$this->assertContains(
			$custom_css_str,
			Newspack_Newsletters_Renderer::render_post_to_mjml( $post_object ),
			'Rendered email contains the custom CSS.'
		);
	}
}

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
					'blockName'    => 'core/paragraph',
					'attrs'        => [],
					'innerBlocks'  => [],
					'innerContent' => [],
					'innerHTML'    => $inner_html,
				]
			),
			'<mj-section padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.5" font-size="16px" >' . $inner_html . '</mj-text></mj-column></mj-section>',
			'Renders default paragraph'
		);

		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/paragraph',
					'attrs'        => [
						'textColor' => 'vivid-purple',
						'fontSize'  => 'normal',
						'style'     => [
							'color' => [
								'background' => '#4aadd7',
							],
						],
					],
					'innerBlocks'  => [],
					'innerContent' => [],
					'innerHTML'    => $inner_html,
				]
			),
			'<mj-section textColor="vivid-purple" color="#db18e6 !important" background-color="#4aadd7 !important" font-size="16px" padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.5" font-size="16px"  textColor="vivid-purple" color="#db18e6 !important" container-background-color="#4aadd7 !important">' . $inner_html . '</mj-text></mj-column></mj-section>',
			'Renders styled paragraph'
		);
	}

	/**
	 * Filter the OEmbed return value.
	 *
	 * @param array $data The data to return.
	 */
	public function set_oembed_value( $data = [] ) {
		global $newspack_newsletters_test_oembed_data;
		$newspack_newsletters_test_oembed_data = $data;
		add_filter(
			'newspack_newsletters_get_oembed_object',
			function() {
				return new class() {
					public function get_data() { // phpcs:disable Squiz.Commenting.FunctionComment.Missing
						global $newspack_newsletters_test_oembed_data;
						return (object) array_merge(
							[
								'title'            => 'Embed',
								'url'              => 'embed.com',
								'width'            => 480,
								'height'           => 360,
								'thumbnail_url'    => 'embed.com/image',
								'thumbnail_width'  => 480,
								'thumbnail_height' => 360,
								'html'             => 'Embed',
							],
							$newspack_newsletters_test_oembed_data
						);
					}
				};
			}
		);
	}

	/**
	 * Test embed blocks rendering.
	 */
	public function test_render_embed_blocks() {
		$this->set_oembed_value(
			[
				'type'          => 'video',
				'provider_name' => 'YouTube',
			]
		);
		// Video embed.
		$inner_html = '<figure><div>https://www.youtube.com/watch?v=aIRgcb3cQ1Q</div></figure>';
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/embed',
					'attrs'        => [
						'url' => 'https://www.youtube.com/watch?v=aIRgcb3cQ1Q',
					],
					'innerBlocks'  => [],
					'innerContent' => [],
					'innerHTML'    => $inner_html,
				]
			),
			'<mj-section url="https://www.youtube.com/watch?v=aIRgcb3cQ1Q" padding="0"><mj-column padding="12px" width="100%"><mj-image padding="0" src="embed.com/image" width="480px" height="360px" href="https://www.youtube.com/watch?v=aIRgcb3cQ1Q" /><mj-text align="center" color="#555d66" line-height="1.56" font-size="13px" >Embed - YouTube</mj-text></mj-column></mj-section>',
			'Renders image from video embed block with title as caption'
		);

		$this->set_oembed_value(
			[
				'type'          => 'photo',
				'provider_name' => 'Flickr',
			]
		);
		// Image with custom caption.
		$inner_html = '<figure><div>https://flickr.com/photos/thomashawk/9274246246</div><figcaption>Automattic</figcaption></figure>';
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/embed',
					'attrs'        => [
						'url' => 'https://flickr.com/photos/thomashawk/9274246246',
					],
					'innerBlocks'  => [],
					'innerContent' => [],
					'innerHTML'    => $inner_html,
				]
			),
			'<mj-section url="https://flickr.com/photos/thomashawk/9274246246" padding="0"><mj-column padding="12px" width="100%"><mj-image src="embed.com" alt="Automattic" width="480" height="360" href="https://flickr.com/photos/thomashawk/9274246246" /><mj-text align="center" color="#555d66" line-height="1.56" font-size="13px" >Automattic - Flickr</mj-text></mj-column></mj-section>',
			'Renders image with inline figcaption as caption'
		);

		// Rich embed as HTML.
		$inner_html = '<figure><div>https://twitter.com/automattic/status/1395447061336711181</div></figure>';
		$this->set_oembed_value(
			[
				'type'          => 'rich',
				'provider_name' => 'Twitter',
			]
		);
		$rendered_string = Newspack_Newsletters_Renderer::render_mjml_component(
			[
				'blockName'    => 'core/embed',
				'attrs'        => [
					'url' => 'https://twitter.com/automattic/status/1395447061336711181',
				],
				'innerBlocks'  => [],
				'innerContent' => [],
				'innerHTML'    => $inner_html,
			]
		);
		$this->assertEquals(
			str_replace( [ "\n", "\r" ], '', $rendered_string ),
			'<mj-section url="https://twitter.com/automattic/status/1395447061336711181" padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.5" font-size="16px" >Embed</mj-text></mj-column></mj-section>',
			'Renders tweet as HTML'
		);

		// Rich embed as link.
		$inner_html = '<figure><div>https://www.amazon.com/Learning-PHP-MySQL-JavaScript-Javascript/dp/1491978910</div></figure>';
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/embed',
					'attrs'        => [
						'url' => 'https://www.amazon.com/Learning-PHP-MySQL-JavaScript-Javascript/dp/1491978910',
					],
					'innerBlocks'  => [],
					'innerContent' => [],
					'innerHTML'    => $inner_html,
				]
			),
			'<mj-section url="https://www.amazon.com/Learning-PHP-MySQL-JavaScript-Javascript/dp/1491978910" padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.5" font-size="16px" >Embed</mj-text></mj-column></mj-section>',
			'Renders invalid rich HTML as link'
		);
	}

	/**
	 * Test buttons blocks rendering.
	 */
	public function test_render_buttons_blocks() {
		// Left aligned button.
		$inner_html = '<button><a>Test Button</a></button>';
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/buttons',
					'attrs'        => [],
					'innerBlocks'  => [
						[
							'blockName'    => 'core/button',
							'attrs'        => [],
							'innerBlocks'  => [],
							'innerContent' => [ $inner_html ],
							'innerHTML'    => $inner_html,
						],
					],
					'innerContent' => [
						'<div>',
						null,
						'</div>',
					],
					'innerHTML'    => '<div></div>',
				]
			),
			'<mj-section padding="0"><mj-wrapper padding="0" text-align="left"><mj-section padding="0" text-align="left"><mj-column padding="12px" css-class="mj-column-has-width" width="100%"><mj-button align="left" padding="0" inner-padding="12px 24px" line-height="1.5" href="" border-radius="999px" font-size="16px"  font-weight="bold" color="#fff !important" background-color="#32373c">Test Button</mj-button></mj-column></mj-section></mj-wrapper></mj-section>',
			'Renders left aligned button'
		);

		// Center aligned button.
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/buttons',
					'attrs'        => [
						'layout' => [
							'justifyContent' => 'center',
						],
					],
					'innerBlocks'  => [
						[
							'blockName'    => 'core/button',
							'attrs'        => [],
							'innerBlocks'  => [],
							'innerContent' => [ $inner_html ],
							'innerHTML'    => $inner_html,
						],
					],
					'innerContent' => [
						'<div>',
						null,
						'</div>',
					],
					'innerHTML'    => '<div></div>',
				]
			),
			'<mj-section  padding="0"><mj-wrapper padding="0" text-align="center"><mj-section padding="0" text-align="center"><mj-column padding="12px" css-class="mj-column-has-width" width="100%"><mj-button align="center" padding="0" inner-padding="12px 24px" line-height="1.5" href="" border-radius="999px" font-size="16px"  font-weight="bold" color="#fff !important" background-color="#32373c">Test Button</mj-button></mj-column></mj-section></mj-wrapper></mj-section>',
			'Renders center aligned button'
		);

		// Right aligned button.
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/buttons',
					'attrs'        => [
						'layout' => [
							'justifyContent' => 'right',
						],
					],
					'innerBlocks'  => [
						[
							'blockName'    => 'core/button',
							'attrs'        => [],
							'innerBlocks'  => [],
							'innerContent' => [ $inner_html ],
							'innerHTML'    => $inner_html,
						],
					],
					'innerContent' => [
						'<div>',
						null,
						'</div>',
					],
					'innerHTML'    => '<div></div>',
				]
			),
			'<mj-section  padding="0"><mj-wrapper padding="0" text-align="right"><mj-section padding="0" text-align="right"><mj-column padding="12px" css-class="mj-column-has-width" width="100%"><mj-button align="right" padding="0" inner-padding="12px 24px" line-height="1.5" href="" border-radius="999px" font-size="16px"  font-weight="bold" color="#fff !important" background-color="#32373c">Test Button</mj-button></mj-column></mj-section></mj-wrapper></mj-section>',
			'Renders right aligned button'
		);


		// Multiple buttons.
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/buttons',
					'attrs'        => [],
					'innerBlocks'  => [
						[
							'blockName'    => 'core/button',
							'attrs'        => [],
							'innerBlocks'  => [],
							'innerContent' => [ $inner_html ],
							'innerHTML'    => $inner_html,
						],
						[
							'blockName'    => 'core/button',
							'attrs'        => [],
							'innerBlocks'  => [],
							'innerContent' => [ $inner_html ],
							'innerHTML'    => $inner_html,
						],
					],
					'innerContent' => [
						'<div>',
						null,
						'</div>',
					],
					'innerHTML'    => '<div></div>',
				]
			),
			'<mj-section padding="0"><mj-wrapper padding="0" text-align="left"><mj-section padding="0" text-align="left"><mj-column padding="12px" css-class="mj-column-has-width" width="50%"><mj-button align="left" padding="0" inner-padding="12px 24px" line-height="1.5" href="" border-radius="999px" font-size="16px"  font-weight="bold" color="#fff !important" background-color="#32373c">Test Button</mj-button></mj-column><mj-column padding="12px" css-class="mj-column-has-width" width="50%"><mj-button align="left" padding="0" inner-padding="12px 24px" line-height="1.5" href="" border-radius="999px" font-size="16px"  font-weight="bold" color="#fff !important" background-color="#32373c">Test Button</mj-button></mj-column></mj-section></mj-wrapper></mj-section>',
			'Renders multiple buttons'
		);
	}

	/**
	 * Test social icons rendering.
	 */
	public function test_render_social_icons() {
		$plugin_path = plugin_dir_url( __DIR__ );
		$this->assertEquals(
			Newspack_Newsletters_Renderer::render_mjml_component(
				[
					'blockName'    => 'core/social-links',
					'attrs'        => [],
					'innerBlocks'  => [
						[
							'blockName'    => 'core/social-link',
							'attrs'        => [
								'url'     => 'https://x.com/hi',
								'service' => 'x',
							],
							'innerBlocks'  => [],
							'innerContent' => [],
							'innerHTML'    => '',
						],
					],
					'innerContent' => [
						'<div>',
						null,
						'</div>',
					],
					'innerHTML'    => '<div></div>',
				]
			),
			'<mj-section padding="0"><mj-column padding="12px" width="100%"><mj-social icon-size="24px" mode="horizontal" padding="0" border-radius="999px" icon-padding="7px" align="left"><mj-social-element href="https://x.com/hi" src="' . $plugin_path . 'assets/white-x.png" background-color="#000000" css-class="social-element"/></mj-social></mj-column></mj-section>',
			'Renders social icons'
		);
	}

	/**
	 * Test other rendering-related function.
	 */
	public function test_aux_functions() {
		$this->assertEquals(
			Newspack_Newsletters_Renderer::process_links( '<a href="//newspack.com">linky<a>' ),
			'<a href="//newspack.com?utm_medium=email">linky<a>',
			'Appends utm_medium=email to links'
		);
		$this->assertEquals(
			Newspack_Newsletters_Renderer::process_links( '<a href="//newspack.com?value=1">linky<a>' ),
			'<a href="//newspack.com?value=1&utm_medium=email">linky<a>',
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

		$this->assertStringContainsString(
			$custom_css_str,
			Newspack_Newsletters_Renderer::render_post_to_mjml( $post_object ),
			'Rendered email contains the custom CSS.'
		);
	}
}

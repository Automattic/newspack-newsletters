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
			'<mj-section padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.8" font-size="16px" >' . $inner_html . '</mj-text></mj-column></mj-section>',
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
			'<mj-section textColor="vivid-purple" color="#db18e6" background-color="#4aadd7" font-size="16px" padding="0"><mj-column padding="12px" width="100%"><mj-text padding="0" line-height="1.8" font-size="16px"  textColor="vivid-purple" color="#db18e6" container-background-color="#4aadd7">' . $inner_html . '</mj-text></mj-column></mj-section>',
			'Renders styled paragraph'
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
}

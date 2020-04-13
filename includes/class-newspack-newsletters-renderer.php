<?php
/**
 * Newspack Newsletter Renderer
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/vendor/autoload.php';

/**
 * Newspack Newsletters Renderer Class.
 */
final class Newspack_Newsletters_Renderer {
	/**
	 * Convert a list to HTML attributes.
	 *
	 * @param array $attributes Array of attributes.
	 * @return string HTML attributes as a string.
	 */
	private static function array_to_attributes( $attributes ) {
		return join(
			' ',
			array_map(
				function( $key ) use ( $attributes ) {
					if ( isset( $attributes[ $key ] ) ) {
						return $key . '="' . $attributes[ $key ] . '"';
					} else {
						return '';
					}
				},
				array_keys( $attributes )
			)
		);
	}

	/**
	 * Get font size based on block attributes.
	 *
	 * @param array $block_attrs Block attributes.
	 * @return string font size.
	 */
	private static function get_font_size( $block_attrs ) {
		if ( isset( $block_attrs['customFontSize'] ) ) {
			return $block_attrs['customFontSize'] . 'px';
		}
		if ( isset( $block_attrs['fontSize'] ) ) {
			// Gutenberg's default font size presets.
			// https://github.com/WordPress/gutenberg/blob/359858da0675943d8a759a0a7c03e7b3846536f5/packages/block-editor/src/store/defaults.js#L87-L113 .
			$sizes = array(
				'small'  => '13px',
				'normal' => '16px',
				'medium' => '20px',
				'large'  => '36px',
				'huge'   => '48px',
			);
			return $sizes[ $block_attrs['fontSize'] ];
		}
	}

	/**
	 * Get colors based on block attributes.
	 *
	 * @param array $block_attrs Block attributes.
	 * @return array Array of color attributes for MJML component.
	 */
	private static function get_colors( $block_attrs ) {
		$colors = array();
		// Gutenberg's default color palette.
		// https://github.com/WordPress/gutenberg/blob/359858da0675943d8a759a0a7c03e7b3846536f5/packages/block-editor/src/store/defaults.js#L30-L85 .
		$colors_palette = array(
			'pale-pink'             => '#f78da7',
			'vivid-red'             => '#cf2e2e',
			'luminous-vivid-orange' => '#ff6900',
			'luminous-vivid-amber'  => '#fcb900',
			'light-green-cyan'      => '#7bdcb5',
			'vivid-green-cyan'      => '#00d084',
			'pale-cyan-blue'        => '#8ed1fc',
			'vivid-cyan-blue'       => '#0693e3',
			'very-light-gray'       => '#eeeeee',
			'cyan-bluish-gray'      => '#abb8c3',
			'very-dark-gray'        => '#313131',
		);

		// For text.
		if ( isset( $block_attrs['textColor'], $colors_palette[ $block_attrs['textColor'] ] ) ) {
			$colors['color'] = $colors_palette[ $block_attrs['textColor'] ];
		}
		// customTextColor is set inline, but it's passed here for consistency.
		if ( isset( $block_attrs['customTextColor'] ) ) {
			$colors['color'] = $block_attrs['customTextColor'];
		}
		if ( isset( $block_attrs['backgroundColor'], $colors_palette[ $block_attrs['backgroundColor'] ] ) ) {
			$colors['background-color'] = $colors_palette[ $block_attrs['backgroundColor'] ];
		}
		// customBackgroundColor is set inline, but not on mjml wrapper element.
		if ( isset( $block_attrs['customBackgroundColor'] ) ) {
			$colors['background-color'] = $block_attrs['customBackgroundColor'];
		}

		// For separators.
		if ( isset( $block_attrs['color'], $colors_palette[ $block_attrs['color'] ] ) ) {
			$colors['border-color'] = $colors_palette[ $block_attrs['color'] ];
		}
		if ( isset( $block_attrs['customColor'] ) ) {
			$colors['border-color'] = $block_attrs['customColor'];
		}
		return $colors;
	}

	/**
	 * Add color attributes and a padding, if component has a background color.
	 *
	 * @param array $attrs Block attributes.
	 * @return array MJML component attributes.
	 */
	private static function process_attributes( $attrs ) {
		$attrs     = array_merge(
			$attrs,
			self::get_colors( $attrs )
		);
		$font_size = self::get_font_size( $attrs );
		if ( isset( $font_size ) ) {
			$attrs['font-size'] = $font_size;
		}

		// Remove block-only attributes.
		array_map(
			function ( $key ) use ( &$attrs ) {
				if ( isset( $attrs[ $key ] ) ) {
					unset( $attrs[ $key ] );
				}
			},
			[ 'customBackgroundColor', 'customTextColor', 'customFontSize', 'fontSize' ]
		);

		if ( isset( $attrs['background-color'] ) ) {
			$attrs['padding'] = '16px';
		}

		if ( isset( $attrs['align'] ) && 'full' == $attrs['align'] ) {
			$attrs['full-width'] = 'full-width';
			unset( $attrs['align'] );
		}
		return $attrs;
	}

	/**
	 * Convert a Gutenberg block to an MJML component.
	 * MJML component will be put in an mj-column in an mj-section for consistent layout,
	 * unless it's a group or a columns block.
	 *
	 * @param WP_Block $block The block.
	 * @param bool     $is_in_column Whether the component is a child of a column component.
	 * @param bool     $is_in_group Whether the component is a child of a group component.
	 * @return string MJML component.
	 */
	private static function render_mjml_component( $block, $is_in_column = false, $is_in_group = false ) {
		$block_name   = $block['blockName'];
		$attrs        = $block['attrs'];
		$inner_blocks = $block['innerBlocks'];
		$inner_html   = $block['innerHTML'];

		if ( empty( $block_name ) || empty( $inner_html ) ) {
			return '';
		}

		$block_mjml_markup = '';
		$attrs             = self::process_attributes( $attrs );

		// Default attributes for the section which will envelop the mj-column.
		$section_attrs = array_merge(
			$attrs,
			array(
				'padding' => '0',
			)
		);

		// Default attributes for the column which will envelop the component.
		$column_attrs = array_merge(
			array(
				'padding' => '10px 16px',
			)
		);

		switch ( $block_name ) {
			/**
			 * Paragraph, List, Heading blocks.
			 */
			case 'core/paragraph':
			case 'core/list':
			case 'core/heading':
			case 'core/quote':
				// TODO disable/handle/warn for:
				// - without inline image
				// - drop cap?
				$text_attrs = array_merge(
					array(
						'padding'     => '0',
						'line-height' => '1.8',
						'font-size'   => '16px',
					),
					$attrs
				);

				// Only mj-text has to use container-background-color attr for background color.
				if ( isset( $text_attrs['background-color'] ) ) {
					$text_attrs['container-background-color'] = $text_attrs['background-color'];
					unset( $text_attrs['background-color'] );
				}

				$block_mjml_markup = '<mj-text ' . self::array_to_attributes( $text_attrs ) . '>' . $inner_html . '</mj-text>';
				break;

			/**
			 * Image block.
			 */
			case 'core/image':
				// TODO disable/handle/warn for:
				// - align right, align left.

				// Parse block content.
				$dom = new DomDocument();
				@$dom->loadHTML( $inner_html ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
				$xpath      = new DOMXpath( $dom );
				$img        = $xpath->query( '//img' )[0];
				$img_src    = $img->getAttribute( 'src' );
				$figcaption = $xpath->query( '//figcaption/text()' )[0];

				$img_attrs = array(
					'padding' => '0',
					'align'   => isset( $attrs['align'] ) ? $attrs['align'] : 'left',
					'src'     => $img_src,
				);

				if ( isset( $attrs['sizeSlug'] ) ) {
					if ( 'medium' == $attrs['sizeSlug'] ) {
						$img_attrs['width'] = '300px';
					}
					if ( 'thumbnail' == $attrs['sizeSlug'] ) {
						$img_attrs['width'] = '150px';
					}
				}
				if ( isset( $attrs['width'] ) ) {
					$img_attrs['width'] = $attrs['width'] . 'px';
				}
				if ( isset( $attrs['height'] ) ) {
					$img_attrs['height'] = $attrs['height'] . 'px';
				}

				if ( isset( $attrs['className'] ) && strpos( $attrs['className'], 'is-style-rounded' ) !== false ) {
					$img_attrs['border-radius'] = '999px';
				}
				$markup = '<mj-image ' . self::array_to_attributes( $img_attrs ) . ' />';

				if ( $figcaption ) {
					$caption_attrs = array(
						'align'     => 'center',
						'color'     => '#555d66',
						'font-size' => '13px',
					);
					 // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
					$markup .= '<mj-text ' . self::array_to_attributes( $caption_attrs ) . '>' . $figcaption->wholeText . '</mj-text>';
				}

				$block_mjml_markup = $markup;
				break;

			/**
			 * Buttons block.
			 */
			case 'core/buttons':
				// TODO disable/handle/warn for:
				// - layouts.

				foreach ( $inner_blocks as $button_block ) {
					// Parse block content.
					$dom = new DomDocument();
					@$dom->loadHTML( $button_block['innerHTML'] ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
					$xpath         = new DOMXpath( $dom );
					$anchor        = $xpath->query( '//a' )[0];
					$attrs         = $button_block['attrs'];
					$text          = $anchor->textContent; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
					$border_radius = isset( $attrs['borderRadius'] ) ? $attrs['borderRadius'] : 28;
					$is_outlined   = isset( $attrs['className'] ) && 'is-style-outline' == $attrs['className'];

					$default_button_attrs = array(
						'padding'       => '0',
						'href'          => $anchor->getAttribute( 'href' ),
						'border-radius' => $border_radius . 'px',
						'font-size'     => '18px',
						// Default color - will be replaced by get_colors if there are colors set.
						'color'         => $is_outlined ? '#32373c' : '#fff',
					);
					if ( $is_outlined ) {
						$default_button_attrs['background-color'] = 'transparent';
					}
					$button_attrs = array_merge(
						$default_button_attrs,
						self::get_colors( $attrs )
					);

					if ( $is_outlined ) {
						$button_attrs['css-class'] = $attrs['className'];
					}

					$block_mjml_markup .= '<mj-column ' . self::array_to_attributes( $column_attrs ) . '><mj-button ' . self::array_to_attributes( $button_attrs ) . ">$text</mj-button></mj-column>";
				}


				break;

			/**
			 * Separator block.
			 */
			case 'core/separator':
				$is_style_default   = true;
				$divider_attrs      = array_merge(
					array(
						'padding'      => '0',
						'border-width' => $is_style_default ? '2px' : '1px',
						'width'        => $is_style_default ? '100px' : '100%',
						// Default color - will be replaced by get_colors if there are colors set.
						'border-color' => '#8f98a1',
					),
					self::get_colors( $attrs )
				);
				$block_mjml_markup .= '<mj-divider ' . self::array_to_attributes( $divider_attrs ) . '/>';

				break;

			/**
			 * Social links block.
			 */
			case 'core/social-links':
				$social_icons = array(
					'wordpress' => array(
						'color' => '#3499cd',
						'icon'  => 'wordpress.svg',
					),
					'facebook'  => array(
						'color' => '#1977f2',
						'icon'  => 'facebook.svg',
					),
					'twitter'   => array(
						'color' => '#21a1f3',
						'icon'  => 'twitter.svg',
					),
					'instagram' => array(
						'color' => '#f00075',
						'icon'  => 'instagram.svg',
					),
					'linkedin'  => array(
						'color' => '#0577b5',
						'icon'  => 'linkedin.svg',
					),
					'youtube'   => array(
						'color' => '#ff0100',
						'icon'  => 'youtube.svg',
					),
				);

				$social_wrapper_attrs = array(
					'align'         => isset( $attrs['align'] ) && 'center' == $attrs['align'] ? 'center' : 'left',
					'icon-size'     => '22px',
					'mode'          => 'horizontal',
					'padding'       => '5px',
					'border-radius' => '999px',
					'icon-padding'  => '8px',
				);
				$markup               = '<mj-social ' . self::array_to_attributes( $social_wrapper_attrs ) . '>';
				foreach ( $inner_blocks as $link_block ) {
					if ( isset( $link_block['attrs']['url'] ) ) {
						$url = $link_block['attrs']['url'];
						// Handle older version of the block, where innner blocks we named `core/social-link-<service>`.
						$service_name = isset( $link_block['attrs']['service'] ) ? $link_block['attrs']['service'] : str_replace( 'core/social-link-', '', $link_block['blockName'] );

						if ( isset( $social_icons[ $service_name ] ) ) {
							$img_attrs = array(
								'href'             => $url,
								'src'              => plugins_url( 'assets/' . $social_icons[ $service_name ]['icon'], dirname( __FILE__ ) ),
								'background-color' => $social_icons[ $service_name ]['color'],
								'css-class'        => 'social-element',
							);

							$markup .= '<mj-social-element ' . self::array_to_attributes( $img_attrs ) . '/>';
						}
					}
				}
				$block_mjml_markup .= $markup . '</mj-social>';

				break;

			/**
			 * Single Column block.
			 */
			case 'core/column':
				// TODO disable/handle/warn for:
				// - alignments. Middle/center will not work in mjml, top and bottom are looking slightly different in G editor and MJML.
				// - nested colums. Not allowed in MJML.

				if ( isset( $attrs['verticalAlignment'] ) ) {
					if ( 'center' == $attrs['verticalAlignment'] ) {
						$column_attrs['vertical-align'] = 'middle';
					} else {
						$column_attrs['vertical-align'] = $attrs['verticalAlignment'];
					}
				}
				if ( isset( $attrs['width'] ) ) {
					$column_attrs['width'] = $attrs['width'] . '%';
				}

				$markup = '<mj-column ' . self::array_to_attributes( $column_attrs ) . '>';
				foreach ( $inner_blocks as $block ) {
					$markup .= self::render_mjml_component( $block, true );
				}
				$block_mjml_markup = $markup . '</mj-column>';
				break;

			/**
			 * Columns block.
			 */
			case 'core/columns':
				$markup = '';
				foreach ( $inner_blocks as $block ) {
					$markup .= self::render_mjml_component( $block, true );
				}
				$block_mjml_markup = $markup;
				break;

			/**
			 * Group block.
			 */
			case 'core/group':
				$markup = '<mj-wrapper ' . self::array_to_attributes( $attrs ) . '>';
				foreach ( $inner_blocks as $block ) {
					$markup .= self::render_mjml_component( $block, false, true );
				}
				$block_mjml_markup = $markup . '</mj-wrapper>';
				break;
		}

		if (
			! $is_in_column &&
			'core/group' != $block_name &&
			'core/columns' != $block_name &&
			'core/column' != $block_name &&
			'core/buttons' != $block_name
		) {
			$column_attrs['width'] = '100%';
			$block_mjml_markup     = '<mj-column ' . self::array_to_attributes( $column_attrs ) . '>' . $block_mjml_markup . '</mj-column>';
		}
		if ( $is_in_column || 'core/group' == $block_name ) {
			// Render a nested block without a wrapping section.
			return $block_mjml_markup;
		} else {
			return '<mj-section ' . self::array_to_attributes( $section_attrs ) . '>' . $block_mjml_markup . '</mj-section>';
		}
	}

	/**
	 * Convert a WP post to MJML markup.
	 *
	 * @param WP_Post $post The post.
	 * @return string MJML markup.
	 */
	private static function render_mjml( $post ) {
		$title  = $post->post_title;
		$blocks = parse_blocks( $post->post_content );
		$body   = '';
		foreach ( $blocks as $block ) {
			$block_content = self::render_mjml_component( $block );
			if ( ! empty( $block_content ) ) {
				$body .= $block_content;
			}
		}

		ob_start();
		include dirname( __FILE__ ) . '/email-template.mjml.php';
		return ob_get_clean();
	}

	/**
	 * Return MJML API credentials.
	 *
	 * @return string API key and API secret as a key:secret string.
	 */
	public static function mjml_api_credentials() {
		$key    = ( defined( 'NEWSPACK_MJML_API_KEY' ) && NEWSPACK_MJML_API_KEY ) ? NEWSPACK_MJML_API_KEY : false;
		$secret = ( defined( 'NEWSPACK_MJML_API_SECRET' ) && NEWSPACK_MJML_API_SECRET ) ? NEWSPACK_MJML_API_SECRET : false;
		if ( isset( $key, $secret ) ) {
			return "$key:$secret";
		}
		return false;
	}

	/**
	 * Convert a WP Post to email-compliant HTML.
	 *
	 * @param WP_Post $post The post.
	 * @return string email-compliant HTML.
	 */
	public static function render_html_email( $post ) {
		$mjml_creds = self::mjml_api_credentials();
		if ( $mjml_creds ) {
			$mjml_api_url = 'https://api.mjml.io/v1/render';
			$request      = wp_remote_post(
				$mjml_api_url,
				array(
					'body'    => wp_json_encode(
						array(
							'mjml' => self::render_mjml( $post ),
						)
					),
					'headers' => array(
						'Authorization' => 'Basic ' . base64_encode( $mjml_creds ),
					),
				)
			);

			$email_html = json_decode( $request['body'] )->html;
			return $email_html;
		}
	}
}

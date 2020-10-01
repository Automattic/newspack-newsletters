<?php
/**
 * Newspack Newsletter Renderer
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Newspack Newsletters Renderer Class.
 */
final class Newspack_Newsletters_Renderer {
	/**
	 * The color palette to be used.
	 *
	 * @var Object
	 */
	public static $color_palette = null;

	/**
	 * The header font.
	 *
	 * @var String
	 */
	protected static $font_header = null;

	/**
	 * The body font.
	 *
	 * @var String
	 */
	protected static $font_body = null;

	/**
	 * Ads to insert.
	 *
	 * @var Array
	 */
	protected static $ads_to_insert = [];

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

		// For text.
		if ( isset( $block_attrs['textColor'], self::$color_palette[ $block_attrs['textColor'] ] ) ) {
			$colors['color'] = self::$color_palette[ $block_attrs['textColor'] ];
		}
		// customTextColor is set inline, but it's passed here for consistency.
		if ( isset( $block_attrs['customTextColor'] ) ) {
			$colors['color'] = $block_attrs['customTextColor'];
		}
		if ( isset( $block_attrs['backgroundColor'], self::$color_palette[ $block_attrs['backgroundColor'] ] ) ) {
			$colors['background-color'] = self::$color_palette[ $block_attrs['backgroundColor'] ];
		}
		// customBackgroundColor is set inline, but not on mjml wrapper element.
		if ( isset( $block_attrs['customBackgroundColor'] ) ) {
			$colors['background-color'] = $block_attrs['customBackgroundColor'];
		}

		// For separators.
		if ( isset( $block_attrs['color'], self::$color_palette[ $block_attrs['color'] ] ) ) {
			$colors['border-color'] = self::$color_palette[ $block_attrs['color'] ];
		}
		if ( isset( $block_attrs['customColor'] ) ) {
			$colors['border-color'] = $block_attrs['customColor'];
		}

		// Custom color handling.
		if ( isset( $block_attrs['style'] ) ) {
			if ( isset( $block_attrs['style']['color']['background'] ) ) {
				$colors['background-color'] = $block_attrs['style']['color']['background'];
			}
			if ( isset( $block_attrs['style']['color']['text'] ) ) {
				$colors['color'] = $block_attrs['style']['color']['text'];
			}
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
			[ 'customBackgroundColor', 'customTextColor', 'customFontSize', 'fontSize', 'backgroundColor', 'style' ]
		);

		if ( isset( $attrs['background-color'] ) ) {
			$attrs['padding'] = '0';
		}

		if ( isset( $attrs['align'] ) && 'full' == $attrs['align'] ) {
			$attrs['full-width'] = 'full-width';
			unset( $attrs['align'] );
		}

		if ( isset( $attrs['full-width'] ) && 'full-width' == $attrs['full-width'] && isset( $attrs['background-color'] ) ) {
			$attrs['padding'] = '12px 0';
		}

		return $attrs;
	}

	/**
	 * Append UTM param to links.
	 *
	 * @param string $html input HTML.
	 * @return string HTML with processed links.
	 */
	public static function process_links( $html ) {
		preg_match_all( '/href="([^"]*)"/', $html, $matches );
		$href_params = $matches[0];
		$urls        = $matches[1];
		foreach ( $urls as $index => $url ) {
			$url_with_params = add_query_arg(
				[
					'utm_medium' => 'email',
				],
				$url
			);
			$html            = str_replace( $href_params[ $index ], 'href="' . $url_with_params . '"', $html );
		}
		return $html;
	}

	/**
	 * Convert a Gutenberg block to an MJML component.
	 * MJML component will be put in an mj-column in an mj-section for consistent layout,
	 * unless it's a group or a columns block.
	 *
	 * @param WP_Block $block The block.
	 * @param bool     $is_in_column Whether the component is a child of a column component.
	 * @param bool     $is_in_group Whether the component is a child of a group component.
	 * @param array    $default_attrs Default attributes for the component.
	 * @return string MJML component.
	 */
	public static function render_mjml_component( $block, $is_in_column = false, $is_in_group = false, $default_attrs = [] ) {
		$block_name   = $block['blockName'];
		$attrs        = $block['attrs'];
		$inner_blocks = $block['innerBlocks'];
		$inner_html   = $block['innerHTML'];

		if ( ! isset( $attrs['innerBlocksToInsert'] ) && ( empty( $block_name ) || empty( $inner_html ) ) ) {
			return '';
		}

		$block_mjml_markup = '';
		$attrs             = self::process_attributes( array_merge( $default_attrs, $attrs ) );

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
				'padding' => '12px',
			)
		);

		$font_family = 'core/heading' === $block_name ? self::$font_header : self::$font_body;

		switch ( $block_name ) {
			/**
			 * Paragraph, List, Heading blocks.
			 */
			case 'core/paragraph':
			case 'core/list':
			case 'core/heading':
			case 'core/quote':
				$text_attrs = array_merge(
					array(
						'padding'     => '0',
						'line-height' => '1.8',
						'font-size'   => '16px',
						'font-family' => $font_family,
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
				} elseif ( isset( $attrs['className'] ) ) {
					if ( 'size-medium' == $attrs['className'] ) {
						$img_attrs['width'] = '300px';
					}
					if ( 'size-thumbnail' == $attrs['className'] ) {
						$img_attrs['width'] = '150px';
					}
				}
				if ( isset( $attrs['width'] ) ) {
					$img_attrs['width'] = $attrs['width'] . 'px';
				}
				if ( isset( $attrs['height'] ) ) {
					$img_attrs['height'] = $attrs['height'] . 'px';
				}
				if ( isset( $attrs['linkDestination'] ) ) {
					$img_attrs['href'] = $attrs['linkDestination'];
				} else {
					$maybe_link = $img->parentNode;// phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
					if ( $maybe_link && 'a' === $maybe_link->nodeName && $maybe_link->getAttribute( 'href' ) ) { // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
						$img_attrs['href'] = trim( $maybe_link->getAttribute( 'href' ) );
					}
				}
				if ( isset( $attrs['className'] ) && strpos( $attrs['className'], 'is-style-rounded' ) !== false ) {
					$img_attrs['border-radius'] = '999px';
				}
				$markup = '<mj-image ' . self::array_to_attributes( $img_attrs ) . ' />';

				if ( $figcaption ) {
					$caption_attrs = array(
						'align'       => 'center',
						'color'       => '#555d66',
						'font-size'   => '13px',
						'font-family' => $font_family,
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
						'inner-padding' => '12px 24px',
						'line-height'   => '1.8',
						'href'          => $anchor->getAttribute( 'href' ),
						'border-radius' => $border_radius . 'px',
						'font-size'     => '18px',
						'font-family'   => $font_family,
						// Default color - will be replaced by get_colors if there are colors set.
						'color'         => $is_outlined ? '#32373c' : '#fff',
					);
					if ( $is_outlined ) {
						$default_button_attrs['background-color'] = 'transparent';
					} else {
						$default_button_attrs['background-color'] = '#32373c';
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
				$is_style_default   = isset( $attrs['className'] ) ? 'is-style-default' == $attrs['className'] : true;
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
			 * Spacer block.
			 */
			case 'core/spacer':
				$attrs['height']    = $attrs['height'] . 'px';
				$block_mjml_markup .= '<mj-spacer ' . self::array_to_attributes( $attrs ) . '/>';
				break;

			/**
			 * Social links block.
			 */
			case 'core/social-links':
				$social_icons = array(
					'wordpress' => array(
						'color' => '#3499cd',
						'icon'  => 'wordpress.png',
					),
					'facebook'  => array(
						'color' => '#1977f2',
						'icon'  => 'facebook.png',
					),
					'twitter'   => array(
						'color' => '#21a1f3',
						'icon'  => 'twitter.png',
					),
					'instagram' => array(
						'color' => '#f00075',
						'icon'  => 'instagram.png',
					),
					'linkedin'  => array(
						'color' => '#0577b5',
						'icon'  => 'linkedin.png',
					),
					'youtube'   => array(
						'color' => '#ff0100',
						'icon'  => 'youtube.png',
					),
				);

				$social_wrapper_attrs = array(
					'icon-size'     => '22px',
					'mode'          => 'horizontal',
					'padding'       => '0',
					'border-radius' => '999px',
					'icon-padding'  => '8px',
				);
				if ( isset( $attrs['align'] ) ) {
					$social_wrapper_attrs['align'] = $attrs['align'];
				} else {
					$social_wrapper_attrs['align'] = 'left';
				}
				$markup = '<mj-social ' . self::array_to_attributes( $social_wrapper_attrs ) . '>';
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
				if ( isset( $attrs['verticalAlignment'] ) ) {
					if ( 'center' === $attrs['verticalAlignment'] ) {
						$column_attrs['vertical-align'] = 'middle';
					} else {
						$column_attrs['vertical-align'] = $attrs['verticalAlignment'];
					}
				}

				if ( isset( $attrs['width'] ) ) {
					$column_attrs['width']     = $attrs['width'] . '%';
					$column_attrs['css-class'] = 'mj-column-has-width';
				}

				$markup = '<mj-column ' . self::array_to_attributes( $column_attrs ) . '>';
				foreach ( $inner_blocks as $block ) {
					$markup .= self::render_mjml_component( $block, true, false, $default_attrs );
				}
				$block_mjml_markup = $markup . '</mj-column>';
				break;

			/**
			 * Columns block.
			 */
			case 'core/columns':
				// Some columns might have no width set.
				$widths_sum            = 0;
				$no_width_cols_indexes = [];
				foreach ( $inner_blocks as $i => $block ) {
					if ( isset( $block['attrs']['width'] ) ) {
						$widths_sum += floatval( $block['attrs']['width'] );
					} else {
						array_push( $no_width_cols_indexes, $i );
					}
				};
				foreach ( $no_width_cols_indexes as $no_width_cols_index ) {
					$inner_blocks[ $no_width_cols_index ]['attrs']['width'] = ( 100 - $widths_sum ) / count( $no_width_cols_indexes );
				};

				if ( isset( $attrs['color'] ) ) {
					$default_attrs['color'] = $attrs['color'];
				}
				$markup = '';
				foreach ( $inner_blocks as $block ) {
					$markup .= self::render_mjml_component( $block, true, false, $default_attrs );
				}
				$block_mjml_markup = $markup;
				break;

			/**
			 * Newspack Newsletters Posts Inserter block template.
			 */
			case 'newspack-newsletters/posts-inserter':
				$markup = '';
				foreach ( $attrs['innerBlocksToInsert'] as $block ) {
					$markup .= self::render_mjml_component( $block );
				}
				$block_mjml_markup = $markup;
				break;

			/**
			 * Group block.
			 */
			case 'core/group':
				// There's no color attribute on mj-wrapper, so it has to be passed to children.
				// https://github.com/mjmlio/mjml/issues/1881 .
				if ( isset( $attrs['color'] ) ) {
					$default_attrs['color'] = $attrs['color'];
				}
				$markup = '<mj-wrapper ' . self::array_to_attributes( $attrs ) . '>';
				foreach ( $inner_blocks as $block ) {
					$markup .= self::render_mjml_component( $block, false, true, $default_attrs );
				}
				$block_mjml_markup = $markup . '</mj-wrapper>';
				break;
		}

		$is_posts_inserter_block = 'newspack-newsletters/posts-inserter' == $block_name;
		$is_group_block          = 'core/group' == $block_name;

		if (
			! $is_in_column &&
			! $is_group_block &&
			'core/columns' != $block_name &&
			'core/column' != $block_name &&
			'core/buttons' != $block_name &&
			! $is_posts_inserter_block
		) {
			$column_attrs['width'] = '100%';
			$block_mjml_markup     = '<mj-column ' . self::array_to_attributes( $column_attrs ) . '>' . $block_mjml_markup . '</mj-column>';
		}
		if ( $is_in_column || $is_group_block || $is_posts_inserter_block ) {
			// Render a nested block without a wrapping section.
			return $block_mjml_markup;
		} else {
			return '<mj-section ' . self::array_to_attributes( $section_attrs ) . '>' . $block_mjml_markup . '</mj-section>';
		}
	}

	/**
	 * Get total length of newsletter's content.
	 *
	 * @param array $blocks Array of post blocks.
	 * @return number Total length of the newsletter content.
	 */
	private static function get_total_newsletter_character_length( $blocks ) {
		return array_reduce(
			$blocks,
			function( $length, $block ) {
				if ( 'newspack-newsletters/posts-inserter' === $block['blockName'] ) {
					$length += self::get_total_newsletter_character_length( $block['attrs']['innerBlocksToInsert'] );
				} elseif ( isset( $block['innerBlocks'] ) && count( $block['innerBlocks'] ) ) {
					$length += self::get_total_newsletter_character_length( $block['innerBlocks'] );
				} else {
					$length += strlen( wp_strip_all_tags( $block['innerHTML'] ) );
				}
				return $length;
			},
			0
		);
	}

	/**
	 * Insert ads in a piece of markup.
	 *
	 * @param string $markup The markup.
	 * @param number $current_position Current position, as character offset.
	 * @return string Markup with ads inserted.
	 */
	private static function insert_ads( $markup, $current_position ) {
		foreach ( self::$ads_to_insert as &$ad_to_insert ) {
			if (
				! $ad_to_insert['is_inserted'] &&
				(
					// If ad is at 100%, insert it only in the last pass, which appends ads to the bottom of the newsletter.
					// Otherwise, such ad might end up right before the last block because of the `>=` check below.
					1 === $ad_to_insert['percentage']
						? INF === $current_position
						: $current_position >= $ad_to_insert['precise_position']
				)
			) {
				$markup                     .= $ad_to_insert['markup'];
				$ad_to_insert['is_inserted'] = true;
			}
		}
		return $markup;
	}

	/**
	 * Convert a WP post to MJML components.
	 *
	 * @param WP_Post $post The post.
	 * @param Boolean $include_ads Whether to include ads.
	 * @return string MJML markup to be injected into the template.
	 */
	private static function post_to_mjml_components( $post, $include_ads ) {
		$body         = '';
		$valid_blocks = array_filter(
			parse_blocks( $post->post_content ),
			function ( $block ) {
				return null !== $block['blockName'];
			}
		);
		$total_length = self::get_total_newsletter_character_length( $valid_blocks );

		// Gather ads.
		if ( $include_ads && ! get_post_meta( $post->ID, 'diable_ads', true ) ) {
			$ads_query = new WP_Query(
				array(
					'post_type'      => Newspack_Newsletters_Ads::NEWSPACK_NEWSLETTERS_ADS_CPT,
					'posts_per_page' => -1,
					'posts_status'   => 'publish',
				)
			);

			foreach ( $ads_query->get_posts() as $ad ) {
				$expiry_date = new DateTime( get_post_meta( $ad->ID, 'expiry_date', true ) );

				// Ad is active if it has no expiry date (a peristent ad) or the date is equal to or after today.
				if ( ! $expiry_date || $expiry_date->format( 'Y-m-d' ) >= gmdate( 'Y-m-d' ) ) {
					$percentage            = intval( get_post_meta( $ad->ID, 'position_in_content', true ) ) / 100;
					self::$ads_to_insert[] = [
						'precise_position' => $total_length * $percentage,
						'percentage'       => $percentage,
						'markup'           => self::post_to_mjml_components( $ad, false ),
						'is_inserted'      => false,
					];
				}
			}
		}

		// Build MJML body and insert ads.
		$current_position = 0;
		foreach ( $valid_blocks as $block ) {
			$block_content = '';

			// Insert ads between top-level group blocks' inner blocks.
			if ( 'core/group' === $block['blockName'] ) {
				$default_attrs = [];
				$attrs         = self::process_attributes( $block['attrs'] );
				if ( isset( $attrs['color'] ) ) {
					$default_attrs['color'] = $attrs['color'];
				}
				$mjml_markup = '<mj-wrapper ' . self::array_to_attributes( $attrs ) . '>';
				foreach ( $block['innerBlocks'] as $block ) {
					$inner_block_content = self::render_mjml_component( $block, false, true, $default_attrs );
					if ( $include_ads ) {
						$current_position += strlen( wp_strip_all_tags( $inner_block_content ) );
						$mjml_markup       = self::insert_ads( $mjml_markup, $current_position );
					}
					$mjml_markup .= $inner_block_content;
				}
				$block_content = $mjml_markup . '</mj-wrapper>';
			} else {
				// Insert ads between other blocks.
				$block_content = self::render_mjml_component( $block );
				if ( $include_ads ) {
					$current_position += strlen( wp_strip_all_tags( $block_content ) );
					$body              = self::insert_ads( $body, $current_position );
				}
			}

			$body .= $block_content;
		}

		// Insert any remaining ads at the end.
		if ( $include_ads ) {
			$body = self::insert_ads( $body, INF );
		}

		return self::process_links( $body );
	}

	/**
	 * Convert a WP post to MJML markup.
	 *
	 * @param WP_Post $post The post.
	 * @return string MJML markup.
	 */
	private static function render_mjml( $post ) {
		self::$color_palette = json_decode( get_option( 'newspack_newsletters_color_palette', false ), true );
		self::$font_header   = get_post_meta( $post->ID, 'font_header', true );
		self::$font_body     = get_post_meta( $post->ID, 'font_body', true );
		if ( ! in_array( self::$font_header, Newspack_Newsletters::$supported_fonts ) ) {
			self::$font_header = 'Arial';
		}
		if ( ! in_array( self::$font_body, Newspack_Newsletters::$supported_fonts ) ) {
			self::$font_body = 'Georgia';
		}

		$title            = $post->post_title; // phpcs:ignore WordPressVIPMinimum.Variables.VariableAnalysis.UnusedVariable
		$body             = self::post_to_mjml_components( $post, true ); // phpcs:ignore WordPressVIPMinimum.Variables.VariableAnalysis.UnusedVariable
		$background_color = get_post_meta( $post->ID, 'background_color', true );
		$preview_text     = get_post_meta( $post->ID, 'preview_text', true );
		if ( ! $background_color ) {
			$background_color = '#ffffff';
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
		$key    = get_option( 'newspack_newsletters_mjml_api_key', false );
		$secret = get_option( 'newspack_newsletters_mjml_api_secret', false );
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
	 * @throws Exception Error message.
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
					'timeout' => 45, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
				)
			);
			if ( 401 === intval( $request['response']['code'] ) ) {
				throw new Exception( __( 'MJML rendering error.', 'newspack_newsletters' ) );
			}
			return is_wp_error( $request ) ? $request : json_decode( $request['body'] )->html;
		}
	}
}

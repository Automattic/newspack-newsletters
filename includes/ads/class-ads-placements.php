<?php
/**
 * Newspack Newsletter Ads Placements.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack_Newsletters;

/**
 * Ads Placements for Newsletters.
 */
final class Ads_Placements {

	/**
	 * Taxonomy name.
	 *
	 * @var string
	 */
	const TAXONOMY = 'newspack_nl_ad_placement';

	/**
	 * Initialize hooks.
	 */
	public static function init_hooks() {
		add_action( 'init', [ __CLASS__, 'register_taxonomy' ] );
	}

	/**
	 * Register placements.
	 */
	public static function register_taxonomy() {
		register_taxonomy(
			self::TAXONOMY,
			[ Ads::CPT ],
			[
				'labels'            => [
					'name'                     => __( 'Ad Placements', 'newspack-newsletters' ),
					'singular_name'            => __( 'Ad Placement', 'newspack-newsletters' ),
					'search_items'             => __( 'Search Ad Placements', 'newspack-newsletters' ),
					'popular_items'            => __( 'Popular Ad Placements', 'newspack-newsletters' ),
					'all_items'                => __( 'All Ad Placements', 'newspack-newsletters' ),
					'parent_items'             => __( 'Parent Ad Placements', 'newspack-newsletters' ),
					'parent_item'              => __( 'Parent Ad Placement', 'newspack-newsletters' ),
					'name_field_description'   => __( 'The ad placement name', 'newspack-newsletters' ),
					'slug_field_description'   => '', // There's no ad placement URL so let's skip slug field description.
					'parent_field_description' => __( 'Assign a parent ad placement', 'newspack-newsletters' ),
					'desc_field_description'   => __( 'Optional description for this ad placement', 'newspack-newsletters' ),
					'edit_item'                => __( 'Edit Ad Placement', 'newspack-newsletters' ),
					'view_item'                => __( 'View Ad Placement', 'newspack-newsletters' ),
					'update_item'              => __( 'Update Ad Placement', 'newspack-newsletters' ),
					'add_new_item'             => __( 'Add New Ad Placement', 'newspack-newsletters' ),
					'new_item_name'            => __( 'New Ad Placement Name', 'newspack-newsletters' ),
					'not_found'                => __( 'No ad placements found', 'newspack-newsletters' ),
					'no_terms'                 => __( 'No ad placements', 'newspack-newsletters' ),
					'filter_by_item'           => __( 'Filter by ad placement', 'newspack-newsletters' ),
				],
				'public'            => true,
				'show_in_rest'      => true,
				'hierarchical'      => false,
				'show_admin_column' => true,
				'rest_base'         => 'ad_placement',
			]
		);
	}
}
Ads_Placements::init_hooks();

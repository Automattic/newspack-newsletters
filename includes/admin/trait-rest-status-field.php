<?php
/**
 * REST status field trait.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Shared `register_rest_field` scaffolding for list-page status fields.
 *
 * Using classes must implement a static `get_status_for_post( \WP_Post|null $post ): array` method.
 */
trait Rest_Status_Field {
	/**
	 * Adapter matching WP's documented field-callback signature
	 * (`( $object, $field_name, $request, $object_type )`) — only
	 * `$object` is used; the rest are accepted defensively for
	 * future strict-mode runtimes and IDE tooling.
	 *
	 * @param array  $post_array  Prepared post response.
	 * @param string $field_name  Unused.
	 * @param mixed  $request     Unused.
	 * @param string $object_type Unused.
	 * @return array
	 */
	public static function rest_get_status( $post_array, $field_name = '', $request = null, $object_type = '' ) {
		unset( $field_name, $request, $object_type );
		$post = isset( $post_array['id'] ) ? get_post( $post_array['id'] ) : null;
		return static::get_status_for_post( $post );
	}

	/**
	 * Register a status field on the given CPT.
	 *
	 * @param string $cpt        CPT slug.
	 * @param string $field_name REST field name.
	 * @param array  $properties Schema `properties` map.
	 */
	protected static function register_status_field( $cpt, $field_name, array $properties ) {
		register_rest_field(
			$cpt,
			$field_name,
			[
				'get_callback' => [ static::class, 'rest_get_status' ],
				'schema'       => [
					'context'    => [ 'view', 'edit' ],
					'type'       => 'object',
					'readonly'   => true,
					'properties' => $properties,
				],
			]
		);
	}
}

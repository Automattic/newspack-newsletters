<?php
/**
 * Newspack Newsletters Send List
 *
 * @package Newspack
 */

namespace Newspack\Newsletters;

use Newspack_Newsletters;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * Class used to represent one Send_List.
 *
 * A Send_List can be either a top-level list or a sublist.
 * A sublist can optionally specify a parent list ID (required for Mailchimp).
 */
class Send_List {
	/**
	 * The configuration associated with this Send_List.
	 *
	 * @var array
	 */
	protected $config;

	/**
	 * If there were errors building the Send_List object due to invalid config, this will contain the error messages.
	 *
	 * @var WP_Error
	 */
	protected $errors;

	/**
	 * Initializes a new Send_List.
	 *
	 * @param array $config {
	 *   The configuration for the Send_list.
	 *
	 *   @type string $provider    The slug of the ESP for which this list or sublist originates (required).
	 *   @type string $type        The type of list. Can be either 'list' or 'sublist'. If the latter, must specify a `parent` property (required).
	 *   @type string $entity_type The type of entity this list or sublist is associated with in the ESP. Controls which ESP API endpoints to use to fetch/update (required).
	 *   @type string $id          The ID of the list or sublist in the ESP (required).
	 *   @type string $value       The value to use for autocomplete inputs. If not passed, will match `id`.
	 *   @type string $parent_id   If this is a sublist of another list, the ID of the parent list.
	 *   @type string $name        The name of the list or sublist as identified in the ESP (required).
	 *   @type string $local_name  If the list is also a Subscription List, it could have a locally edited name.
	 *   @type string $label       The label to use for autocomplete inputs. If not set, will be generated from other properties.
	 *   @type int    $count       If available, the number of contacts associated with this list or sublist.
	 *   @type string $edit_link   If available, the URL to edit this list or sublist in the ESP.
	 * }
	 */
	public function __construct( $config ) {
		$this->errors = new WP_Error();
		$schema       = self::get_config_schema();

		foreach ( $schema['properties'] as $key => $property ) {
			// If the property is required but not set, throw an error.
			if ( ! empty( $property['required'] ) && ! isset( $config[ $key ] ) ) {
				$this->errors->add( 'newspack_newsletters_send_list_invalid_config', __( 'Missing required config property: ', 'newspack-newsletters' ) . $key );
				continue;
			}

			// No need to continue if an optional key isn't set.
			if ( ! isset( $config[ $key ] ) ) {
				continue;
			}

			// Set the property.
			$this->set( $key, $config[ $key ] );
		}
	}

	/**
	 * Get the config data schema for a single Send_List.
	 * See __construct() method docblock for details.
	 *
	 * @return array
	 */
	public static function get_config_schema() {
		return [
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => [
				'provider'    => [
					'name'     => 'provider',
					'type'     => 'string',
					'required' => true,
					'enum'     => Newspack_Newsletters::get_supported_providers(),
				],
				'type'        => [
					'name'     => 'type',
					'type'     => 'string',
					'required' => true,
					'enum'     => [
						'list',
						'sublist',
					],
				],
				'entity_type' => [
					'name'     => 'entity_type',
					'type'     => 'string',
					'required' => true,
				],
				'id'          => [
					'name'     => 'id',
					'type'     => 'string',
					'required' => true,
				],
				'value'       => [
					'name'     => 'value',
					'type'     => 'string',
					'required' => false,
				],
				'name'        => [
					'name'     => 'name',
					'type'     => 'string',
					'required' => true,
				],
				'label'       => [
					'name'     => 'label',
					'type'     => 'string',
					'required' => false,
				],
				'local_name'  => [
					'name'     => 'local_name',
					'type'     => 'string',
					'required' => false,
				],
				'count'       => [
					'name'     => 'count',
					'type'     => 'integer',
					'required' => false,
				],
				'parent_id'   => [
					'name'     => 'parent_id',
					'type'     => 'string',
					'required' => false,
				],
				'edit_link'   => [
					'name'     => 'edit_link',
					'type'     => 'string',
					'required' => false,
				],
			],
		];
	}

	/**
	 * Helper method to get a specific property's value.
	 * Not for public use. Use specific property getters instead.
	 *
	 * @param string $key The property to get.
	 *
	 * @return mixed|WP_Error The property value or null if not set/not a supported property.
	 */
	private function get( $key ) {
		// Clear previous errors for this key.
		$this->errors->remove( 'newspack_newsletters_send_list_missing_required_property_' . $key );
		$value  = $this->{ $key } ?? null;
		$schema = $this->get_config_schema();
		if ( ! empty( $schema['properties'][ $key ]['required'] ) && null === $this->{ $key } ) {
			$error_message = new WP_Error( 'newspack_newsletters_send_list_missing_required_property_' . $key, __( 'Could not get required property: ', 'newspack-newsletters' ) . $key );
			$error_message->export_to( $this->get_errors() );
			return $error_message;
		}

		return $value;
	}

	/**
	 * Helper method to set a property's value.
	 * Not for public use. Use specific property setters instead.
	 *
	 * @param string $key The property to get.
	 * @param mixed  $value The value to set.
	 *
	 * @return mixed|WP_Error The property value or WP_Error if not set/not a supported property.
	 */
	private function set( $key, $value ) {
		// Clear previous errors for this key.
		$this->errors->remove( 'newspack_newsletters_send_list_invalid_property_' . $key );
		$schema = $this->get_config_schema();
		if ( ! isset( $schema['properties'][ $key ] ) ) {
			$error_message = new WP_Error( 'newspack_newsletters_send_list_invalid_property_' . $key, __( 'Could not set invalid property: ', 'newspack-newsletters' ) . $key );
			$error_message->export_to( $this->get_errors() );
			return $error_message;
		}

		// If the passed value isn't in the enum, throw an error.
		$this->errors->remove( 'newspack_newsletters_send_list_invalid_property_value_' . $key );
		$property = $schema['properties'][ $key ];
		if ( isset( $property['enum'] ) && ! in_array( $value, $property['enum'], true ) ) {
			$error_message = new WP_Error( 'newspack_newsletters_send_list_invalid_property_value_' . $key, __( 'Invalid value for property: ', 'newspack-newsletters' ) . $key );
			$error_message->export_to( $this->get_errors() );
			return $error_message;
		}

		// Cast value to the expected type.
		settype( $value, $property['type'] );

		$this->{ $key } = $value;
		return $this->get( $key );
	}

	/**
	 * Get any errors associated with this Send_List.
	 *
	 * @return WP_Error
	 */
	public function get_errors() {
		return $this->errors;
	}

	/**
	 * Get the provider for this Send_List.
	 */
	public function get_provider() {
		return $this->get( 'provider' );
	}

	/**
	 * Get the ID for this Send_List.
	 */
	public function get_id() {
		return $this->get( 'id' );
	}

	/**
	 * Get the type for this Send_List: list or sublist.
	 */
	public function get_type() {
		return $this->get( 'type' );
	}

	/**
	 * Get the entity type for this Send_List.
	 */
	public function get_entity_type() {
		return $this->get( 'entity_type' );
	}

	/**
	 * Get the name for this Send_List.
	 */
	public function get_name() {
		return $this->get( 'name' );
	}

	/**
	 * Update the name for this Send_List.
	 *
	 * @param string $value The new name.
	 */
	public function set_name( $value ) {
		return $this->set( 'name', $value );
	}

	/**
	 * Get the local name for this Send_List, if the entity is also a Subscription_List.
	 */
	public function get_local_name() {
		return $this->get( 'local_name' );
	}

	/**
	 * Update the local name for this Send_List, if the entity is also a Subscription_List.
	 *
	 * @param string $value The new name.
	 */
	public function set_local_name( $value ) {
		return $this->set( 'local_name', $value );
	}

	/**
	 * Get a manually set or dynamic label for autocomplete inputs.
	 * If not manually set, generate from entity_type, name, and count and store.
	 *
	 * @return string
	 */
	public function get_label() {
		$stored_label = $this->get( 'label' );
		if ( ! empty( $stored_label ) ) {
			return $stored_label;
		}

		$entity_type = '[' . strtoupper( $this->get( 'entity_type' ) ) . ']';
		$count       = $this->get( 'count' );
		$name        = $this->get( 'name' );

		$contact_count = null !== $count ?
			sprintf(
				// Translators: If available, show a contact count alongside the suggested item. %d is the number of contacts in the suggested item.
				_n( '(%s contact)', '(%s contacts)', $count, 'newspack-newsletters' ),
				number_format( $count )
			) : '';

		return trim( "$entity_type $name $contact_count" );
	}

	/**
	 * Get the value for autocomplete inputs. Defaults to the id.
	 *
	 * @return string
	 */
	public function get_value() {
		return $this->get( 'value' ) ?? $this->get( 'id' );
	}

	/**
	 * Convert the Send_List to an array for use with the REST API.
	 *
	 * @return array
	 */
	public function to_array() {
		$schema = self::get_config_schema();
		$config  = [];
		foreach ( $schema['properties'] as $key => $property ) {
			$config[ $key ] = $this->get( $key ) ?? null;
		}
		$config = array_filter( $config ); // Remove empty values.

		// Ensure label + value properties are set for JS components.
		if ( ! isset( $config['label'] ) ) {
			$config['label'] = $this->get_label();
		}
		if ( ! isset( $config['value'] ) ) {
			$config['value'] = $this->get_value();
		}

		return $config;
	}
}

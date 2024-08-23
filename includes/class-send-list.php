<?php
/**
 * Newspack Newsletters Send List
 *
 * @package Newspack
 */

namespace Newspack\Newsletters;

use Newspack_Newsletters;
use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Class used to represent one Send_List.
 *
 * A Send_List can be either a top-level list or a sublist.
 * A sublist must specify a parent list ID.
 */
class Send_List {
	/**
	 * The configuration associated with this Send_List.
	 *
	 * @var array
	 */
	protected $config;

	/**
	 * Initializes a new Send_List.
	 *
	 * @param array $config The configuration for the Send_List.
	 * @throws \InvalidArgumentException In case the Send_List object can't be built from the given config data.
	 */
	public function __construct( $config ) {
		$schema = self::get_config_schema();
		$errors = [];

		foreach ( $schema['properties'] as $key => $property ) {
			// If the property is required but not set, throw an error.
			if ( ! empty( $property['required'] ) && ! isset( $config[ $key ] ) ) {
				$errors[] = __( 'Missing required config: ', 'newspack-newsletters' ) . $key;
				continue;
			}

			// No need to continue if an optional key isn't set.
			if ( ! isset( $config[ $key ] ) ) {
				continue;
			}

			// If the passed value isn't in the enum, throw an error.
			if ( isset( $property['enum'] ) && isset( $config[ $key ] ) && ! in_array( $config[ $key ], $property['enum'], true ) ) {
				$errors[] = __( 'Invalid value for config: ', 'newspack-newsletters' ) . $key;
				continue;
			}

			// Cast value to the expected type.
			settype( $config[ $key ], $property['type'] );

			// Set the property.
			$this->set( $key, $config[ $key ] );
		}

		if ( ! empty( $errors ) ) {
			throw new \InvalidArgumentException( esc_html( __( 'Error creating send list: ', 'newspack-newsletters' ) . implode( ' | ', $errors ) ) );
		}

		$this->set_label_and_value();
	}

	/**
	 * Get the config data schema for a single Send_List.
	 */
	public static function get_config_schema() {
		return [
			'type'                 => 'object',
			'additionalProperties' => false,
			'properties'           => [
				// The slug of the ESP for which this list or sublist originates.
				'provider'    => [
					'name'     => 'provider',
					'type'     => 'string',
					'required' => true,
					'enum'     => Newspack_Newsletters::get_supported_providers(),
				],
				// The type of list. Can be either 'list' or 'sublist'. If the latter, must specify a `parent` property.
				'type'        => [
					'name'     => 'type',
					'type'     => 'string',
					'required' => true,
					'enum'     => [
						'list',
						'sublist',
					],
				],
				// The type of entity this list or sublist is associated with in the ESP. Controls which ESP API endpoints to use to fetch/update.
				'entity_type' => [
					'name'     => 'entity_type',
					'type'     => 'string',
					'required' => true,
				],
				// The ID of the list or sublist as identified in the ESP.
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
				// The name of the list or sublist as identified in the ESP.
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
				// If the list is also a Subscription List, it could have a locally edited name.
				'local_name'  => [
					'name'     => 'local_name',
					'type'     => 'string',
					'required' => false,
				],
				// If available, the number of contacts associated with this list or sublist.
				'count'       => [
					'name'     => 'count',
					'type'     => 'integer',
					'required' => false,
				],
				// If this Send_List is a sublist, this property must indicate the ID of the parent list.
				'parent'      => [
					'name'     => 'parent',
					'type'     => 'string',
					'required' => false,
				],
				// If it can be calculated, the URL to view this list or sublist in the ESP's dashboard.
				'edit_link'   => [
					'name'     => 'edit_link',
					'type'     => 'string',
					'required' => false,
				],
			],
		];
	}

	/**
	 * Get the Send_List configuration.
	 *
	 * @return array
	 */
	public function get_config() {
		$schema = self::get_config_schema();
		$config  = [];
		foreach ( $schema['properties'] as $key => $property ) {
			$config[ $key ] = $this->get( $key ) ?? null;
		}

		return array_filter( $config );
	}

	/**
	 * Get a specific property's value.
	 *
	 * @param string $key The property to get.
	 *
	 * @return mixed The property value or null if not set/not a supported property.
	 */
	public function get( $key ) {
		return $this->{ $key } ?? null;
	}

	/**
	 * Set a property's value.
	 *
	 * @param string $key The property to get.
	 * @param mixed  $value The value to set.
	 *
	 * @return mixed The property value or null if not set/not a supported property.
	 */
	public function set( $key, $value ) {
		$schema = $this->get_config_schema();
		if ( ! isset( $schema['properties'][ $key ] ) ) {
			return null;
		}
		$this->{ $key } = $value;
		return $this->get( $key );
	}

	/**
	 * Set the label and value properties for autocomplete inputs.
	 */
	public function set_label_and_value() {
		$entity_type = '[' . strtoupper( $this->get( 'entity_type' ) ) . ']';
		$count       = $this->get( 'count' );
		$name        = $this->get( 'name' );

		$contact_count = null !== $count ?
			sprintf(
				// Translators: If available, show a contact count alongside the suggested item. %d is the number of contacts in the suggested item.
				_n( '(%s contact)', '(%s contacts)', $count, 'newspack-newsletters' ),
				number_format( $count )
			) : '';

		$this->set( 'value', $this->get( 'id' ) );
		$this->set( 'label', trim( "$entity_type $name $contact_count" ) );
	}
}

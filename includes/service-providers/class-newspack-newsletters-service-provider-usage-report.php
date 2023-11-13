<?php
/**
 * Newspack Newsletters Provider Usage Report class.
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Campaign Monitor ESP Usage Report class
 *
 * This simple class holds the usage of the ESP for one day - usually yesterday.
 */
class Newspack_Newsletters_Service_Provider_Usage_Report {

	/**
	 * The number of emails sent.
	 *
	 * @var integer
	 */
	private $emails_sent = 0;

	/**
	 * The number of emails opened.
	 *
	 * @var integer
	 */
	private $opens = 0;

	/**
	 * The number of emails clicked.
	 *
	 * @var integer
	 */
	private $clicks = 0;

	/**
	 * The number of subscribers that unsubscribed.
	 *
	 * @var integer
	 */
	private $unsubscribes = 0;

	/**
	 * The number of new subscribers.
	 *
	 * @var integer
	 */
	private $subscribes = 0;

	/**
	 * The site of the contacts list.
	 *
	 * @var integer
	 */
	private $total_contacts = 0;

	/**
	 * The properties allowed to be informed.
	 *
	 * @var array
	 */
	private $allowed_properties = [
		'emails_sent',
		'opens',
		'clicks',
		'unsubscribes',
		'subscribes',
		'total_contacts',
	];

	/**
	 * Magic method to set the properties. Only allowed properties will be set.
	 *
	 * @param string $name The name of the property.
	 * @param int    $value The value of the property.
	 */
	public function __set( $name, $value ) {
		if ( in_array( $name, $this->allowed_properties ) && is_int( $value ) ) {
			$this->$name = $value;
		}
	}

	/**
	 * Gets the value of a property.
	 *
	 * @param string $name The property name.
	 * @return int The property value.
	 */
	public function __get( $name ) {
		if ( in_array( $name, $this->allowed_properties ) ) {
			return $this->$name;
		}
	}

	/**
	 * Constructor.
	 *
	 * You can pass all the properties as an array or set them individually after the object is created.
	 *
	 * @param array $report_array An array of properties to set.
	 */
	public function __construct( $report_array = [] ) {
		foreach ( $report_array as $key => $value ) {
			$this->__set( $key, $value );
		}
	}

	/**
	 * Calculates and returns the growth rate of the contacts list.
	 *
	 * @return float The growth rate of the contacts list.
	 */
	public function get_growth_rate() {
		if ( 1 > $this->total_contacts ) {
			return (float) 0;
		}
		return ( $this->subscribes - $this->unsubscribes ) / $this->total_contacts;
	}

	/**
	 * Gets this report as an array
	 *
	 * @return array The report as an array.
	 */
	public function to_array() {
		$array = [];
		foreach ( $this->allowed_properties as $property ) {
			$array[ $property ] = $this->$property;
		}
		$array['growth_rate'] = $this->get_growth_rate();
		return $array;
	}
}

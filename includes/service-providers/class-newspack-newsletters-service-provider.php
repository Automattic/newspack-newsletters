<?php
/**
 * Service Provider: Mailchimp Implementation
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

use Newspack\Newsletters\Subscription_List;
use Newspack\Newsletters\Subscription_Lists;

/**
 * Main Newspack Newsletters Class.
 */
abstract class Newspack_Newsletters_Service_Provider extends Newspack_Newsletters_Service_Provider_Base {

	/**
	 * Class constructor.
	 */
	public function __construct() {
		parent::__construct( $this );
	}

	/**
	 * Get a reader-facing error message to be shown when the add_contact method fails.
	 *
	 * @param array $params Additional information about the request that triggered the error.
	 *
	 * @return string
	 */
	public function get_add_contact_reader_error_message( $params = [] ) {
		/**
		 * A default error message to show to readers if their signup request results in an error.
		 *
		 * @param string $reader_error The default error message.
		 * @param array  $params Additional information about the request that triggered the error.
		 */
		$reader_error = apply_filters(
			'newspack_newsletters_add_contact_reader_error_message',
			__( "Sorry, this email cannot be subscribed to this newsletter. Please contact support with the email list you were trying to subscribe to and we'll add you to the list.", 'newspack-newsletters' ),
			$params
		);
		return $reader_error;
	}

	/**
	 * Get the provider specific labels
	 *
	 * This allows us to make reference to provider specific features in the way the user is used to see them in the provider's UI
	 *
	 * This methos must return an array with localized labels forfollowing keys:
	 * - name: The provider name.
	 * - list: "list" in lower case singular format.
	 * - lists: "list" in lower case plural format.
	 * - sublist: Sublist entities in lowercase singular format.
	 * - List: "list" in uppercase case singular format.
	 * - Lists: "list" in uppercase case plural format.
	 * - Sublist: Sublist entities in uppercase singular format.
	 * - tag_prefix: The prefix to be used in tags.
	 * - tag_metabox_before_save: The message to show before saving a list that will create a tag.
	 * - tag_metabox_after_save: The message to show after saving a list that created a tag.
	 *
	 * @param mixed $context The context in which the labels are being applied. Either list_explanation or local_list_explanation.
	 * @return array
	 */
	public static function get_labels( $context = '' ) {
		return [
			'name'                    => '', // The provider name.
			'list'                    => __( 'list', 'newspack-newsletters' ), // "list" in lower case singular format.
			'lists'                   => __( 'lists', 'newspack-newsletters' ), // "list" in lower case plural format.
			'sublist'                 => __( 'sublist', 'newspack-newsletters' ), // Sublist entities in lowercase singular format.
			'List'                    => __( 'List', 'newspack-newsletters' ), // "list" in uppercase case singular format.
			'Lists'                   => __( 'Lists', 'newspack-newsletters' ), // "list" in uppercase case plural format.
			'Sublist'                 => __( 'Sublist', 'newspack-newsletters' ), // Sublist entities in uppercase singular format.
			'tag_prefix'              => 'Newspack: ', // The prefix to be used in tags.
			'tag_metabox_before_save' => __( 'Once this list is saved, a tag will be created for it.', 'newspack-newsletters' ),
			'tag_metabox_after_save'  => __( 'Tag created for this list', 'newspack-newsletters' ),
		];
	}

	/**
	 * Get usage data for yesterday.
	 *
	 * @return Newspack_Newsletters_Service_Provider_Usage_Report|WP_Error|null Usage report, error or Null in case there's no need to check for a report.
	 */
	public function get_usage_report() {
		return null; // Not implemented for the provider.
	}
}

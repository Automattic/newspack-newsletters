<?php
/**
 * Newspack Newsletters Contacts class.
 *
 * This class holds the methods for managing contacts. It's meant to be used by this plugin and by external integrations.
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Class Newspack_Newsletters_Contacts
 */
class Newspack_Newsletters_Contacts {

	/**
	 * Upserts a contact to lists.
	 *
	 * @param array          $contact {
	 *          Contact information.
	 *
	 *    @type string   $email    Contact email address.
	 *    @type string   $name     Contact name. Optional.
	 *    @type string[] $metadata Contact additional metadata. Optional.
	 * }
	 * @param string[]|false $lists   Array of list IDs to subscribe the contact to. If empty or false, contact will be created but not subscribed to any lists.
	 *
	 * @return array|WP_Error|true Contact data if it was added, or error otherwise. True if async.
	 */
	public static function upsert( $contact, $lists = false ) {
		if ( ! is_array( $lists ) && false !== $lists ) {
			$lists = [ $lists ];
		}

		/**
		 * Trigger an action before contact adding.
		 *
		 * @param string[]|false $lists    Array of list IDs the contact will be subscribed to, or false.
		 * @param array          $contact  {
		 *          Contact information.
		 *
		 *    @type string   $email    Contact email address.
		 *    @type string   $name     Contact name. Optional.
		 *    @type string[] $metadata Contact additional metadata. Optional.
		 * }
		 */
		do_action( 'newspack_newsletters_pre_add_contact', $lists, $contact );

		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}

		if ( false !== $lists ) {
			Newspack_Newsletters_Logger::log( 'Adding contact to list(s): ' . implode( ', ', $lists ) . '. Provider is ' . $provider->service . '.' );
		} else {
			Newspack_Newsletters_Logger::log( 'Adding contact without lists. Provider is ' . $provider->service . '.' );
		}

		$existing_contact                 = Newspack_Newsletters_Subscription::get_contact_data( $contact['email'], true );
		$contact['existing_contact_data'] = \is_wp_error( $existing_contact ) ? false : $existing_contact;
		$is_updating                      = \is_wp_error( $existing_contact ) ? false : true;

		/**
		 * Filters the contact before passing on to the API.
		 *
		 * @param array          $contact           {
		 *          Contact information.
		 *
		 *    @type string   $email                 Contact email address.
		 *    @type string   $name                  Contact name. Optional.
		 *    @type string   $existing_contact_data Existing contact data, if updating a contact. The hook will be also called when
		 *    @type string[] $metadata              Contact additional metadata. Optional.
		 * }
		 * @param string[]|false $selected_list_ids Array of list IDs the contact will be subscribed to, or false.
		 * @param string         $provider          The provider name.
		 */
		$contact = apply_filters( 'newspack_newsletters_contact_data', $contact, $lists, $provider->service );

		if ( isset( $contact['metadata'] ) ) {
			Newspack_Newsletters_Logger::log( 'Adding contact with metadata key(s): ' . implode( ', ', array_keys( $contact['metadata'] ) ) . '.' );
		}

		if ( ! isset( $contact['metadata'] ) ) {
			$contact['metadata'] = [];
		}
		$contact['metadata']['origin_newspack'] = '1';

		/**
		 * Filters the contact selected lists before passing on to the API.
		 *
		 * @param string[]|false $lists    Array of list IDs the contact will be subscribed to, or false.
		 * @param array          $contact  {
		 *          Contact information.
		 *
		 *    @type string   $email    Contact email address.
		 *    @type string   $name     Contact name. Optional.
		 *    @type string[] $metadata Contact additional metadata. Optional.
		 * }
		 * @param string         $provider          The provider name.
		 */
		$lists = apply_filters( 'newspack_newsletters_contact_lists', $lists, $contact, $provider->service );

		$errors = new WP_Error();
		$result = [];
		try {
			if ( method_exists( $provider, 'add_contact_with_groups_and_tags' ) ) {
				$result = $provider->add_contact_with_groups_and_tags( $contact, $lists );
			} elseif ( empty( $lists ) ) {
				$result = $provider->add_contact( $contact );
			} else {
				foreach ( $lists as $list_id ) {
					$result = $provider->add_contact( $contact, $list_id );
				}
			}
		} catch ( \Exception $e ) {
			$errors->add( 'newspack_newsletters_subscription_add_contact', $e->getMessage() );
		}

		if ( is_wp_error( $result ) ) {
			$errors->add( $result->get_error_code(), $result->get_error_message() );
		}

		// Handle local lists feature.
		foreach ( $lists as $list_id ) {
			try {
				$provider->add_contact_handling_local_list( $contact, $list_id );
			} catch ( \Exception $e ) {
				$errors->add( 'newspack_newsletters_subscription_handling_local_list', $e->getMessage() );
			}
		}

		/**
		 * Fires after a contact is added.
		 *
		 * @param string              $provider The provider name.
		 * @param array               $contact  {
		 *    Contact information.
		 *
		 *    @type string   $email    Contact email address.
		 *    @type string   $name     Contact name. Optional.
		 *    @type string[] $metadata Contact additional metadata. Optional.
		 * }
		 * @param string[]|false      $lists    Array of list IDs to subscribe the contact to.
		 * @param array|WP_Error      $result   Array with data if the contact was added or error if failed.
		 * @param bool                $is_updating Whether the contact is being updated. If false, the contact is being created.
		 */
		do_action( 'newspack_newsletters_add_contact', $provider->service, $contact, $lists, $result, $is_updating );

		if ( $errors->has_errors() ) {
			return $errors;
		}

		return $result;
	}

	/**
	 * Permanently delete a user subscription.
	 *
	 * @param int $user_id User ID.
	 *
	 * @return bool|WP_Error Whether the contact was deleted or error.
	 */
	public static function delete( $user_id ) {
		$user = get_user_by( 'id', $user_id );
		if ( ! $user ) {
			return new WP_Error( 'newspack_newsletters_invalid_user', __( 'Invalid user.' ) );
		}
		/** Only delete if email ownership is verified. */
		if ( ! Newspack_Newsletters_Subscription::is_email_verified( $user_id ) ) {
			return new \WP_Error( 'newspack_newsletters_email_not_verified', __( 'Email ownership is not verified.' ) );
		}
		$provider = Newspack_Newsletters::get_service_provider();
		if ( empty( $provider ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider', __( 'Provider is not set.' ) );
		}
		if ( ! method_exists( $provider, 'delete_contact' ) ) {
			return new WP_Error( 'newspack_newsletters_invalid_provider_method', __( 'Provider does not support deleting user subscriptions.' ) );
		}
		return $provider->delete_contact( $user->user_email );
	}

	/**
	 * Update a contact lists subscription.
	 *
	 * This method will remove the contact from all subscription lists and add
	 * them to the specified lists.
	 *
	 * @param string   $email Contact email address.
	 * @param string[] $lists Array of list IDs to subscribe the contact to.
	 *
	 * @return bool|WP_Error Whether the contact was updated or error.
	 */
	public static function update_lists( $email, $lists = [] ) {
		if ( ! Newspack_Newsletters_Subscription::has_subscription_management() ) {
			return new WP_Error( 'newspack_newsletters_not_supported', __( 'Not supported for this provider', 'newspack-newsletters' ) );
		}
		$provider = Newspack_Newsletters::get_service_provider();

		Newspack_Newsletters_Logger::log( 'Updating lists of a contact. List selection: ' . implode( ', ', $lists ) . '. Provider is ' . $provider->service . '.' );

		/** Determine lists to add/remove from existing list config. */
		$lists_config    = Newspack_Newsletters_Subscription::get_lists_config();
		$lists_to_add    = array_intersect( array_keys( $lists_config ), $lists );
		$lists_to_remove = array_diff( array_keys( $lists_config ), $lists );

		/** Clean up lists to add/remove from contact's existing data. */
		$current_lists   = Newspack_Newsletters_Subscription::get_contact_lists( $email );
		$lists_to_add    = array_diff( $lists_to_add, $current_lists );
		$lists_to_remove = array_intersect( $current_lists, $lists_to_remove );

		if ( empty( $lists_to_add ) && empty( $lists_to_remove ) ) {
			return false;
		}

		$result = $provider->update_contact_lists_handling_local( $email, $lists_to_add, $lists_to_remove );

		/**
		 * Fires after a contact's lists are updated.
		 *
		 * @param string        $provider        The provider name.
		 * @param string        $email           Contact email address.
		 * @param string[]      $lists_to_add    Array of list IDs to subscribe the contact to.
		 * @param string[]      $lists_to_remove Array of list IDs to remove the contact from.
		 * @param bool|WP_Error $result          True if the contact was updated or error if failed.
		 */
		do_action( 'newspack_newsletters_update_contact_lists', $provider->service, $email, $lists_to_add, $lists_to_remove, $result );

		return $result;
	}
}

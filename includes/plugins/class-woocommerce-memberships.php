<?php
/**
 * Newspack Newsletters Settings Page
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Plugins;

use Newspack\Newsletters\Subscription_List;

defined( 'ABSPATH' ) || exit;

/**
 * Manages Settings page.
 */
class Woocommerce_Memberships {

	/** 
	 * Initialize the hooks
	 */
	public static function init() {
		if ( ! class_exists( 'WC_Memberships' ) ) {
			return;
		}
		add_filter( 'newspack_newsletters_contact_lists', [ __CLASS__, 'filter_lists' ] );
		add_filter( 'newspack_newsletters_subscription_block_available_lists', [ __CLASS__, 'filter_lists' ] );
		add_action( 'wc_memberships_user_membership_cancelled', [ __CLASS__, 'remove_user_from_list' ] );
	}

	/**
	 * Keep users from being added to lists that require a membership plan they dont have
	 * Also filters lists that require a membership plan to be displayed in the subscription block
	 *
	 * @param array $lists The List IDs.
	 * @return array
	 */
	public static function filter_lists( $lists ) {
		if ( ! is_array( $lists ) || empty( $lists ) ) {
			return $lists;
		}
		$lists = array_filter(
			$lists,
			function( $list ) {
				if ( Subscription_List::is_form_id( $list ) ) {
					$list_id = Subscription_List::get_id_from_form_id( $list );
					if ( ! wc_memberships_user_can( get_current_user_id(), 'view', [ 'post' => $list_id ] ) ) {
						Newspack_Newsletters_Logger::log( 'List ' . $list . ' requires a Membership plan. Removing it from the user' );
						return false;
					}
				}
				return true;
			} 
		);
		return $lists;
	}

	/**
	 * Remove lists that require a membership plan when the membership is cancelled
	 *
	 * @param WC_Memberships_User_Membership $user_membership The User Membership object.
	 * @return void
	 */
	public static function remove_user_from_list( $user_membership ) {
		$lists_to_remove = [];
		$user            = $user_membership->get_user();
		if ( ! $user ) {
			return;
		}
		$user_email = $user->user_email;
		$rules      = $user_membership->get_plan()->get_content_restriction_rules();
		foreach ( $rules as $rule ) {
			if ( Subscription_Lists::CPT !== $rule->get_content_type_name() ) {
				continue;
			}
			$object_ids = $rule->get_object_ids();
			foreach ( $object_ids as $object_id ) {
				$subscription_list = new Subscription_List( $object_id );
				$lists_to_remove[] = $subscription_list->get_form_id();
			}
		}
		$provider = Newspack_Newsletters::get_service_provider();
		$provider->update_contact_lists( $user_email, [], $lists_to_remove );
		
	}

}

Woocommerce_Memberships::init();

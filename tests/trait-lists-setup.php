<?php
/**
 * Class Newsletters Test Subscription_List
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Subscription_List;
use Newspack\Newsletters\Subscription_Lists;

/**
 * Tests the Subscription_List class
 */
trait Lists_Setup {

	/**
	 * Testing posts
	 *
	 * @var array
	 */
	public static $posts;

	/**
	 * Sets up testing data
	 *
	 * @return void
	 */
	public static function set_up_before_class() {

		$without_settings = self::create_post( 1 );

		$only_mailchimp = self::create_post( 2 );
		update_post_meta(
			$only_mailchimp,
			Subscription_List::META_KEY,
			[
				'mailchimp' => [
					'list'     => 'mc_list',
					'tag_id'   => 12,
					'tag_name' => 'MC Tag',
				],
			]
		);

		$two_settings = self::create_post( 3 );
		update_post_meta(
			$two_settings,
			Subscription_List::META_KEY,
			[
				'mailchimp'       => [
					'list'     => 'mc_list',
					'tag_id'   => 12,
					'tag_name' => 'MC Tag',
				],
				'active_campaign' => [
					'list'     => 'ac_list',
					'tag_id'   => 13,
					'tag_name' => 'AC Tag',
				],
			]
		);

		$mc_invalid = self::create_post( 4 );
		update_post_meta(
			$mc_invalid,
			Subscription_List::META_KEY,
			[
				'mailchimp'       => [
					'error' => 'Error',
				],
				'active_campaign' => [
					'list'     => 'ac_list',
					'tag_id'   => 13,
					'tag_name' => 'AC Tag',
				],
			]
		);

		$remote_mailchimp      = self::create_post( 5 );
		$remote_mailchimp_list = new Subscription_List( $remote_mailchimp );
		$remote_mailchimp_list->set_remote_id( 'xyz-' . $remote_mailchimp );
		$remote_mailchimp_list->set_type( 'remote' );
		$remote_mailchimp_list->set_provider( 'mailchimp' );

		$remote_mailchimp_inactive      = self::create_post( 6 );
		$remote_mailchimp_inactive_list = new Subscription_List( $remote_mailchimp_inactive );
		$remote_mailchimp_inactive_list->set_remote_id( 'xyz-' . $remote_mailchimp_inactive );
		$remote_mailchimp_inactive_list->set_type( 'remote' );
		$remote_mailchimp_inactive_list->set_provider( 'mailchimp' );
		$remote_mailchimp_inactive_list->update( [ 'active' => false ] );

		self::$posts = compact( 'without_settings', 'only_mailchimp', 'two_settings', 'mc_invalid', 'remote_mailchimp', 'remote_mailchimp_inactive' );
	}

	/**
	 * Create a test post
	 *
	 * @param string|int $index An index to identify the post title and description.
	 * @return int
	 */
	public static function create_post( $index ) {
		$data = [
			'post_title'   => 'Test List ' . $index,
			'post_content' => 'Description ' . $index,
			'post_type'    => Subscription_Lists::CPT,
			'post_status'  => 'publish',
		];
		return wp_insert_post( $data );
	}

}

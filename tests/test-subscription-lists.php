<?php
/**
 * Class Newsletters Test Subscription_List
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Subscription_List;
use Newspack\Newsletters\Subscription_Lists;
use Newspack_Newsletters;

/**
 * Tests the Subscription_List class
 */
class Subscription_Lists_Test extends WP_UnitTestCase {

	use Lists_Setup;

	/**
	 * Test get_all
	 */
	public function test_get_all() {
		$all = Subscription_Lists::get_all();
		$this->assertSame( 6, count( $all ) );
	}

	/**
	 * Test get_configured_for_provider
	 */
	public function test_get_configured_for_provider() {
		$all = Subscription_Lists::get_configured_for_provider( 'mailchimp' );
		$this->assertSame( 4, count( $all ) );
		foreach ( $all as $list ) {
			$this->assertInstanceOf( Subscription_List::class, $list );
			$this->assertTrue( $list->is_configured_for_provider( 'mailchimp' ) );
			$this->assertNotSame( self::$posts['without_settings'], $list->get_id() );
			$this->assertNotSame( self::$posts['mc_invalid'], $list->get_id() );
		}

		$all = Subscription_Lists::get_configured_for_provider( 'active_campaign' );
		$this->assertSame( 2, count( $all ) );
		foreach ( $all as $list ) {
			$this->assertInstanceOf( Subscription_List::class, $list );
			$this->assertTrue( $list->is_configured_for_provider( 'active_campaign' ) );
			$this->assertNotSame( self::$posts['only_mailchimp'], $list->get_id() );
		}
	}

	/**
	 * Test get_configured_for_provider
	 */
	public function test_get_configured_for_current_provider() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );
		$all = Subscription_Lists::get_configured_for_current_provider();
		$this->assertSame( 4, count( $all ) );
		foreach ( $all as $list ) {
			$this->assertInstanceOf( Subscription_List::class, $list );
			$this->assertTrue( $list->is_configured_for_provider( 'mailchimp' ) );
			$this->assertNotSame( self::$posts['without_settings'], $list->get_id() );
			$this->assertNotSame( self::$posts['mc_invalid'], $list->get_id() );
		}

		Newspack_Newsletters::set_service_provider( 'active_campaign' );
		$all = Subscription_Lists::get_configured_for_current_provider();
		$this->assertSame( 2, count( $all ) );
		foreach ( $all as $list ) {
			$this->assertInstanceOf( Subscription_List::class, $list );
			$this->assertTrue( $list->is_configured_for_provider( 'active_campaign' ) );
			$this->assertNotSame( self::$posts['only_mailchimp'], $list->get_id() );
		}
	}

	/**
	 * Test get_filtered
	 */
	public function test_get_filtered() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );
		$id  = self::$posts['only_mailchimp'];
		$all = Subscription_Lists::get_filtered(
			function( $list ) use ( $id ) {
				return $list->get_id() === $id;
			}
		);

		$this->assertSame( 1, count( $all ) );
		$this->assertSame( $id, $all[0]->get_id() );
		
	}

	/**
	 * Test get_list_by_remote_id
	 */
	public function test_get_list_by_remote_id() {
		$existing = 'xyz-' . self::$posts['remote_mailchimp'];
		$found    = Subscription_Lists::get_list_by_remote_id( $existing );
		$this->assertSame( self::$posts['remote_mailchimp'], $found->get_id() );
		$this->assertSame( 'mailchimp', $found->get_provider() );
		$this->assertSame( $existing, $found->get_remote_id() );

		$non_existing = 'asdqwe';
		$found        = Subscription_Lists::get_list_by_remote_id( $non_existing );
		$this->assertNull( $found );
	}

	/**
	 * Test create_remote_list
	 */
	public function test_create_remote_list() {
		$current_provider = Newspack_Newsletters::get_service_provider();
		$remote_id        = 'xyz-123';
		$title            = 'Test Remote List';
		$list             = Subscription_Lists::create_remote_list( $remote_id, $title );
		$this->assertSame( $remote_id, $list->get_remote_id() );
		$this->assertSame( $title, $list->get_title() );
		$this->assertSame( 'remote', $list->get_type() );
		$this->assertSame( $current_provider->service, $list->get_provider() );

		$check = Subscription_Lists::get_list_by_remote_id( $remote_id );
		$this->assertSame( $check->get_id(), $list->get_id() );
	}

	/**
	 * Test get_remote_list
	 */
	public function test_get_remote_list() {

		$count = count( Subscription_Lists::get_all() );

		// existing.
		$existing = [
			'id'   => 'xyz-' . self::$posts['remote_mailchimp'],
			'name' => 'Remote mailchimp new title',
		];
		$list     = Subscription_Lists::get_remote_list( $existing );
		$this->assertSame( self::$posts['remote_mailchimp'], $list->get_id() );
		$this->assertSame( 'Test List 5', $list->get_title() );

		$count_after_existing = count( Subscription_Lists::get_all() );
		$this->assertSame( $count, $count_after_existing );

		
		// new.
		Newspack_Newsletters::set_service_provider( 'active_campaign' );
		$new  = [
			'id'   => 'xyz-abcde',
			'name' => 'New random list',
		];
		$list = Subscription_Lists::get_remote_list( $new );
		$this->assertSame( 'New random list', $list->get_title() );
		$this->assertSame( 'xyz-abcde', $list->get_remote_id() );
		$this->assertSame( 'active_campaign', $list->get_provider() );

		$count_after_new = count( Subscription_Lists::get_all() );
		$this->assertSame( $count + 1, $count_after_new );
	}

	/**
	 * Test update_lists method
	 *
	 * @return void
	 */
	public function test_update() {
		
		$new_lists = [
			[
				'id'   => self::$posts['only_mailchimp'],
				'name' => 'New title',
			],
			[
				'id'     => 'xyz-' . self::$posts['remote_mailchimp'],
				'name'   => 'Remote mailchimp new title',
				'active' => false,
			],
			[
				'id'   => 'xyz-abcde',
				'name' => 'New random list',
			],
		];

		Subscription_Lists::update_lists( $new_lists );

		$count = count( Subscription_Lists::get_all() );

		// 3 local lists should be marked as deactivated.
		// 1 remote list should be deleted and one should be added.
		$this->assertSame( 6, $count );

		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertSame( false, $list->is_active() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( false, $list->is_active() );

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertSame( false, $list->is_active() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( true, $list->is_active() );
		$this->assertSame( 'New title', $list->get_title() );
		$this->assertSame( self::$posts['only_mailchimp'], $list->get_id() );

		$list = Subscription_Lists::get_list_by_remote_id( 'xyz-' . self::$posts['remote_mailchimp'] );
		$this->assertSame( false, $list->is_active() );
		$this->assertSame( 'Remote mailchimp new title', $list->get_title() );
		$this->assertSame( self::$posts['remote_mailchimp'], $list->get_id() );

		$list = Subscription_Lists::get_list_by_remote_id( 'xyz-' . self::$posts['remote_mailchimp_inactive'] );
		$this->assertNull( $list );

		$list = Subscription_Lists::get_list_by_remote_id( 'xyz-abcde' );
		$this->assertSame( true, $list->is_active() );
		$this->assertSame( 'New random list', $list->get_title() );

	}

}

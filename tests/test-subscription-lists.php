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
		$this->assertSame( 4, count( $all ) );
	}

	/**
	 * Test get_configured_for_provider
	 */
	public function test_get_configured_for_provider() {
		$all = Subscription_Lists::get_configured_for_provider( 'mailchimp' );
		$this->assertSame( 2, count( $all ) );
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
		$this->assertSame( 2, count( $all ) );
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

}

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
class Subscription_List_Test extends WP_UnitTestCase {

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
	public function set_up() {

		$without_settings = self::create_post( 1 );

		$only_mailchimp = self::create_post( 2 );
		update_post_meta(
			$only_mailchimp,
			Subscription_List::META_KEY,
			[
				'mailchimp' => [
					'list' => 'mc_list',
					'tag'  => 'mc_tag',
				],
			]
		);

		$two_settings = self::create_post( 3 );
		update_post_meta(
			$two_settings,
			Subscription_List::META_KEY,
			[
				'mailchimp'       => [
					'list' => 'mc_list',
					'tag'  => 'mc_tag',
				],
				'active_campaign' => [
					'list' => 'ca_list',
					'tag'  => 'ac_tag',
				],
			]
		);

		self::$posts = compact( 'without_settings', 'only_mailchimp', 'two_settings' );
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

	/**
	 * Tests constructor with ID
	 */
	public function test_constructor_with_id() {
		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertInstanceOf( Subscription_List::class, $list );
		$this->assertSame( self::$posts['without_settings'], $list->get_id() );
		$this->assertSame( 'Description 1', $list->get_description() );
	}

	/**
	 * Tests constructor with object
	 */
	public function test_constructor_with_object() {
		$list = new Subscription_List( get_post( self::$posts['without_settings'] ) );
		$this->assertInstanceOf( Subscription_List::class, $list );
		$this->assertSame( self::$posts['without_settings'], $list->get_id() );
		$this->assertSame( 'Description 1', $list->get_description() );
	}

	/**
	 * Tests constructor with object
	 */
	public function test_constructor_with_invalid() {
		$this->expectException( \InvalidArgumentException::class );
		$list = new Subscription_List( 9999 );
	}

	/**
	 * Test get_all_providers_settings
	 */
	public function test_get_all_providers_settings() {
		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertEquals( [], $list->get_all_providers_settings() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertEquals(
			[
				'mailchimp'       => [
					'list' => 'mc_list',
					'tag'  => 'mc_tag',
				],
				'active_campaign' => [
					'list' => 'ca_list',
					'tag'  => 'ac_tag',
				],
			],
			$list->get_all_providers_settings() 
		);
	}

	/**
	 * Test get_all_providers_settings
	 */
	public function test_get_providers_settings() {
		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertNull( $list->get_provider_settings( 'mailchimp' ) );
		$this->assertNull( $list->get_provider_settings( 'active_campaign' ) );
		$this->assertNull( $list->get_provider_settings( 'anything' ) );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertNotNull( $list->get_provider_settings( 'mailchimp' ) );
		$this->assertNull( $list->get_provider_settings( 'active_campaign' ) );
		$this->assertNull( $list->get_provider_settings( 'anything' ) );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertNotNull( $list->get_provider_settings( 'mailchimp' ) );
		$this->assertNotNull( $list->get_provider_settings( 'active_campaign' ) );
		$this->assertNull( $list->get_provider_settings( 'anything' ) );

		$this->assertSame(
			[
				'list' => 'ca_list',
				'tag'  => 'ac_tag',
			],
			$list->get_provider_settings( 'active_campaign' )
		);

	}

	/**
	 * Test get_current_provider_settings
	 */
	public function test_get_current_provider_settings() {

		Newspack_Newsletters::set_service_provider( 'mailchimp' );

		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertNull( $list->get_current_provider_settings() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertNotNull( $list->get_current_provider_settings() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertNotNull( $list->get_current_provider_settings() );

		Newspack_Newsletters::set_service_provider( 'active_campaign' );

		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertNull( $list->get_current_provider_settings() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertNull( $list->get_current_provider_settings() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertNotNull( $list->get_current_provider_settings() );
	}

	/**
	 * Test get_configured_providers method
	 */
	public function test_get_configured_providers() {
		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertSame( [], $list->get_configured_providers() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( [ 'mailchimp' ], $list->get_configured_providers() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( [ 'mailchimp', 'active_campaign' ], $list->get_configured_providers() );
	}

	/**
	 * Test get_configured_providers_names method
	 */
	public function test_get_configured_providers_names() {
		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertSame( [], $list->get_configured_providers_names() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( [ 'Mailchimp' ], $list->get_configured_providers_names() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( [ 'Mailchimp', 'Active Campaign' ], $list->get_configured_providers_names() );
	}

	/**
	 * Test get_other_configured_providers method
	 */
	public function test_get_other_configured_providers() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );

		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertSame( [], $list->get_other_configured_providers() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( [], $list->get_other_configured_providers() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( [ 'active_campaign' ], $list->get_other_configured_providers() );

		Newspack_Newsletters::set_service_provider( 'active_campaign' );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( [ 'mailchimp' ], $list->get_other_configured_providers() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( [ 'mailchimp' ], $list->get_other_configured_providers() );
	}

	/**
	 * Test get_other_configured_providers_names method
	 */
	public function test_get_other_configured_providers_names() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );

		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertSame( [], $list->get_other_configured_providers_names() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( [], $list->get_other_configured_providers_names() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( [ 'Active Campaign' ], $list->get_other_configured_providers_names() );

		Newspack_Newsletters::set_service_provider( 'active_campaign' );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( [ 'Mailchimp' ], $list->get_other_configured_providers_names() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( [ 'Mailchimp' ], $list->get_other_configured_providers_names() );
	}

	/**
	 * Test has_other_providers_configured method
	 */ 
	public function test_has_other_providers_configured() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );

		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertFalse( $list->has_other_providers_configured() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertFalse( $list->has_other_providers_configured() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertTrue( $list->has_other_providers_configured() );

		Newspack_Newsletters::set_service_provider( 'active_campaign' );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertTrue( $list->has_other_providers_configured() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertTrue( $list->has_other_providers_configured() );
	}

	/**
	 * Test update_current_provider_settings method
	 */
	public function test_update_current_provider_settings() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );

		$list = new Subscription_List( self::$posts['without_settings'] );

		$this->assertFalse( $list->update_current_provider_settings( '', 'test' ) );
		$this->assertNull( $list->get_current_provider_settings() );

		$this->assertNotFalse( $list->update_current_provider_settings( '123', 'test' ) );
		$this->assertSame(
			[
				'list' => '123',
				'tag'  => 'test',
			],
			$list->get_current_provider_settings()
		);

	}

}

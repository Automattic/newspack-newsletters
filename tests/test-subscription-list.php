<?php
/**
 * Class Newsletters Test Subscription_List
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Subscription_List;
use Newspack_Newsletters;

/**
 * Tests the Subscription_List class
 */
class Subscription_List_Test extends WP_UnitTestCase {

	use Lists_Setup;

	/**
	 * Data provider for test_static_methods
	 *
	 * @return array
	 */
	public function static_methods_data() {
		return [
			[
				Subscription_List::FORM_ID_PREFIX . '123',
				true,
				123,
			],
			[
				Subscription_List::FORM_ID_PREFIX . '2',
				true,
				2,
			],
			[
				Subscription_List::FORM_ID_PREFIX . '0',
				false,
				null,
			],
			[
				Subscription_List::FORM_ID_PREFIX . '12d',
				false,
				null,
			],
			[
				'a' . Subscription_List::FORM_ID_PREFIX . '2',
				false,
				null,
			],
			[
				Subscription_List::FORM_ID_PREFIX . '2.3',
				false,
				null,
				
			],
			[
				'',
				false,
				null,
			],
			[
				true,
				false,
				null,
			],
			[
				array(),
				false,
				null,
			],
			[
				array( 'test' ),
				false,
				null,
			],
			[
				(object) array( 'test' ),
				false,
				null,
			],
			[
				null,
				false,
				null,
			],
		];
	}

	/**
	 * Tests the form ID static methods
	 *
	 * @param mixed $input The input for the methods.
	 * @param mixed $is_form_id The expected result of is_form_id.
	 * @param mixed $extracted_id The expected result of get_id_from_form_id.
	 * @return void
	 * @dataProvider static_methods_data
	 */
	public function test_static_methods( $input, $is_form_id, $extracted_id ) {
		$this->assertSame( $is_form_id, Subscription_List::is_form_id( $input ) );
		$this->assertSame( $extracted_id, Subscription_List::get_id_from_form_id( $input ) );
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
	 * Tests constructor with form_id
	 */
	public function test_constructor_with_form_id() {
		$list = new Subscription_List( Subscription_List::FORM_ID_PREFIX . self::$posts['without_settings'] );
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
	 * Tests get_form_id
	 */
	public function test_get_form_id() {
		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertSame( Subscription_List::FORM_ID_PREFIX . self::$posts['without_settings'], $list->get_form_id() );
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
					'list'     => 'mc_list',
					'tag_id'   => 12,
					'tag_name' => 'MC Tag',
				],
				'active_campaign' => [
					'list'     => 'ac_list',
					'tag_id'   => 13,
					'tag_name' => 'AC Tag',
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
				'list'     => 'ac_list',
				'tag_id'   => 13,
				'tag_name' => 'AC Tag',
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

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertSame( [ 'active_campaign' ], $list->get_configured_providers() );
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

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertSame( [ 'Active Campaign' ], $list->get_configured_providers_names() );
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

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertSame( [ 'active_campaign' ], $list->get_other_configured_providers() );

		Newspack_Newsletters::set_service_provider( 'active_campaign' );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( [ 'mailchimp' ], $list->get_other_configured_providers() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( [ 'mailchimp' ], $list->get_other_configured_providers() );

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertSame( [], $list->get_other_configured_providers() );
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

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertSame( [ 'Active Campaign' ], $list->get_other_configured_providers_names() );

		Newspack_Newsletters::set_service_provider( 'active_campaign' );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertSame( [ 'Mailchimp' ], $list->get_other_configured_providers_names() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertSame( [ 'Mailchimp' ], $list->get_other_configured_providers_names() );

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertSame( [], $list->get_other_configured_providers_names() );
	}

	/**
	 * Test has_other_configured_providers method
	 */ 
	public function test_has_other_configured_providers() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );

		$list = new Subscription_List( self::$posts['without_settings'] );
		$this->assertFalse( $list->has_other_configured_providers() );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertFalse( $list->has_other_configured_providers() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertTrue( $list->has_other_configured_providers() );

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertTrue( $list->has_other_configured_providers() );

		Newspack_Newsletters::set_service_provider( 'active_campaign' );

		$list = new Subscription_List( self::$posts['only_mailchimp'] );
		$this->assertTrue( $list->has_other_configured_providers() );

		$list = new Subscription_List( self::$posts['two_settings'] );
		$this->assertTrue( $list->has_other_configured_providers() );

		$list = new Subscription_List( self::$posts['mc_invalid'] );
		$this->assertFalse( $list->has_other_configured_providers() );
	}

	/**
	 * Test update_current_provider_settings method
	 */
	public function test_update_current_provider_settings() {
		Newspack_Newsletters::set_service_provider( 'mailchimp' );

		$list = new Subscription_List( self::$posts['without_settings'] );

		$this->assertNotFalse( $list->update_current_provider_settings( '', 'test', 'test' ) );
		$this->assertNotEmpty( $list->get_current_provider_settings()['error'] );

		$this->assertNotFalse( $list->update_current_provider_settings( '', 'test', 'test', 'error' ) );
		$this->assertSame( 'error', $list->get_current_provider_settings()['error'] );

		$this->assertNotFalse( $list->update_current_provider_settings( '123', 123, 'test' ) );
		$this->assertSame(
			[
				'list'     => '123',
				'tag_id'   => 123,
				'tag_name' => 'test',
			],
			$list->get_current_provider_settings()
		);

	}

	/**
	 * Data provider for test_is_configured
	 */
	public function is_configured_data() {
		return [
			[
				[
					'list'     => '123',
					'tag_id'   => 123,
					'tag_name' => 'test',
				],
				true,
			],
			[
				[
					'list'     => '123',
					'tag_id'   => 123,
					'tag_name' => 'test',
					'error'    => '',
				],
				true,
			],
			[
				[
					'list'     => '123',
					'tag_id'   => 123,
					'tag_name' => 'test',
					'error'    => 'Error',
				],
				false,
			],
			[
				[
					'list'     => '',
					'tag_id'   => 123,
					'tag_name' => 'test',
				],
				false,
			],
			[
				[
					'list'     => '123',
					'tag_id'   => 0,
					'tag_name' => 'test',
				],
				false,
			],
		];
	}

	/**
	 * Test is_configured_for_provider
	 *
	 * @param mixed $meta The metadata for provider.
	 * @param mixed $expected The expected value for is_configured_for_provider.
	 * @return void
	 * @dataProvider is_configured_data
	 */
	public function test_is_configured( $meta, $expected ) {
		$post_id = self::create_post( 99 );
		update_post_meta( $post_id, Subscription_List::META_KEY, [ 'mailchimp' => $meta ] );
		$list = new Subscription_List( $post_id );
		$this->assertSame( $expected, $list->is_configured_for_provider( 'mailchimp' ) );
	}

}

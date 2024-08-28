<?php
/**
 * Class Newsletters Test Send_List
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Send_List;

/**
 * Tests the Send_List class
 */
class Send_List_Test extends WP_UnitTestCase {

	use Send_Lists_Setup;

	/**
	 * Test constructor.
	 */
	public function test_constructor() {
		$list    = new Send_List( self::$configs['valid_list'] );
		$sublist = new Send_List( self::$configs['valid_sublist'] );
		$this->assertInstanceOf( Send_List::class, $list );
		$this->assertInstanceOf( Send_List::class, $sublist );
	}

	/**
	 * Test constructor with invalid input.
	 */
	public function test_constructor_with_invalid() {
		$this->expectException( \InvalidArgumentException::class );
		$list = new Send_List( self::$configs['invalid'] );
	}


	/**
	 * Test get_config_schema.
	 */
	public function test_get_config_schema() {
		$config = self::$configs['valid_list'];
		$config['unsupported_prop'] = 'unsupported';

		$list       = new Send_List( $config );
		$list_config = $list->get_config();
		$schema     = $list->get_config_schema();

		// Unsupported props are ignored.
		$this->assertArrayNotHasKey( 'unsupported_prop', $list_config );
		foreach ( $list_config as $key => $value ) {
			$this->assertArrayHasKey( $key, $schema['properties'] );
		}
	}

	/**
	 * Test get method.
	 */
	public function test_get() {
		$config   = self::$configs['valid_sublist'];
		$sublist = new Send_List( $config );
		$this->assertSame( $config['provider'], $sublist->get( 'provider' ) );
	}

	/**
	 * Test type casting.
	 */
	public function test_type() {
		$config          = self::$configs['valid_list'];
		$config['id']    = 123; // Integer.
		$config['count'] = '100'; // String.
		$list           = new Send_List( $config );
		$schema         = $list->get_config_schema();
		foreach ( $config as $key => $value ) {
			$this->assertSame( gettype( $list->get( $key ) ), $schema['properties'][ $key ]['type'] );
		}
	}
}

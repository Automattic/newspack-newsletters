<?php
/**
 * Class Newsletters Test Send_Lists
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Send_List;
use Newspack\Newsletters\Send_Lists;

/**
 * Tests the Send_List class
 */
class Send_Lists_Test extends WP_UnitTestCase {

	use Send_Lists_Setup;

	/**
	 * Test matching by item ID.
	 */
	public function test_match_by_id() {
		$this->assertTrue( Send_Lists::matches_id( '123', '123' ) ); // Single ID matches.
		$this->assertTrue( Send_Lists::matches_id( [ '123', '456' ], '123' ) ); // Array of IDs matches.
		$this->assertFalse( Send_Lists::matches_id( '456', '123' ) ); // Single of ID doesn't match.
		$this->assertFalse( Send_Lists::matches_id( [ '456', '789' ], '123' ) ); // Array of IDs doesn't match.
	}

	/**
	 * Test matching by search term(s).
	 */
	public function test_match_by_search() {
		$this->assertTrue( Send_Lists::matches_search( 'search', [ 'search term', 'another term' ] ) ); // Single term matches.
		$this->assertTrue( Send_Lists::matches_search( [ 'search', 'no match' ], [ 'search term', 'another term' ] ) ); // Single term matches.
		$this->assertFalse( Send_Lists::matches_search( 'no match', [ 'search term', 'another term' ] ) ); // Single of ID doesn't match.
		$this->assertFalse( Send_Lists::matches_search( [ 'no match', 'another no match' ], [ 'search term', 'another term' ] ) ); // Array of IDs doesn't match.
	}
}

<?php
/**
 * Tests for the `get_merge_tags()` provider method introduced in NEWS-2242.
 *
 * @package Newspack_Newsletters
 */

/**
 * Test_Service_Provider_Merge_Tags class.
 */
class Test_Service_Provider_Merge_Tags extends WP_UnitTestCase {

	/**
	 * Base class default should return an empty label and tags array.
	 */
	public function test_base_class_default_is_empty() {
		$result = Newspack_Newsletters_Service_Provider::get_merge_tags();
		$this->assertIsArray( $result );
		$this->assertArrayHasKey( 'label', $result );
		$this->assertArrayHasKey( 'tags', $result );
		$this->assertSame( '', $result['label'] );
		$this->assertSame( [], $result['tags'] );
	}
}

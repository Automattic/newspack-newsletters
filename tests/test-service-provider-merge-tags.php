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

	/**
	 * Editor data should contain a merge_tags key with label and tags sub-keys.
	 */
	public function test_email_editor_data_includes_merge_tags_key() {
		\Newspack_Newsletters::set_service_provider( 'mailchimp' );
		$data = Newspack_Newsletters_Editor::get_email_editor_data();
		$this->assertArrayHasKey( 'merge_tags', $data );
		$this->assertIsArray( $data['merge_tags'] );
		$this->assertArrayHasKey( 'label', $data['merge_tags'] );
		$this->assertArrayHasKey( 'tags', $data['merge_tags'] );
	}

	/**
	 * When no provider is set, merge_tags should have empty label and tags.
	 */
	public function test_email_editor_data_merge_tags_empty_when_no_provider() {
		\Newspack_Newsletters::set_service_provider( '' );
		$data = Newspack_Newsletters_Editor::get_email_editor_data();
		$this->assertSame( '', $data['merge_tags']['label'] );
		$this->assertSame( [], $data['merge_tags']['tags'] );
	}
}

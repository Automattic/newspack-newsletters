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

	/**
	 * Mailchimp get_merge_tags() should return the 'merge tag' label.
	 */
	public function test_mailchimp_merge_tags_has_label() {
		$result = Newspack_Newsletters_Mailchimp::get_merge_tags();
		$this->assertSame( 'merge tag', $result['label'] );
	}

	/**
	 * Mailchimp merge tags should include the FNAME tag.
	 */
	public function test_mailchimp_merge_tags_includes_fname() {
		$result = Newspack_Newsletters_Mailchimp::get_merge_tags();
		$tags   = array_column( $result['tags'], 'tag' );
		$this->assertContains( '*|FNAME|*', $tags );
	}

	/**
	 * Mailchimp merge tags should include the ARCHIVE tag.
	 */
	public function test_mailchimp_merge_tags_includes_archive() {
		$result = Newspack_Newsletters_Mailchimp::get_merge_tags();
		$tags   = array_column( $result['tags'], 'tag' );
		$this->assertContains( '*|ARCHIVE|*', $tags );
	}

	/**
	 * Every entry in the Mailchimp merge tags dictionary must have tag and label keys.
	 */
	public function test_mailchimp_merge_tags_entries_have_required_keys() {
		$result = Newspack_Newsletters_Mailchimp::get_merge_tags();
		$this->assertNotEmpty( $result['tags'] );
		foreach ( $result['tags'] as $entry ) {
			$this->assertArrayHasKey( 'tag', $entry );
			$this->assertArrayHasKey( 'label', $entry );
			$this->assertIsString( $entry['label'] );
			$this->assertNotEmpty( $entry['label'] );
			$this->assertIsString( $entry['tag'] );
			$this->assertNotEmpty( $entry['tag'] );
			$this->assertStringStartsWith( '*|', $entry['tag'] );
			$this->assertStringEndsWith( '|*', $entry['tag'] );
		}
	}

	/**
	 * ActiveCampaign get_merge_tags() should return the 'personalization tag' label.
	 */
	public function test_active_campaign_merge_tags_has_label() {
		$result = Newspack_Newsletters_Active_Campaign::get_merge_tags();
		$this->assertSame( 'personalization tag', $result['label'] );
	}

	/**
	 * ActiveCampaign merge tags should include the %FIRSTNAME% tag.
	 */
	public function test_active_campaign_merge_tags_includes_firstname() {
		$result = Newspack_Newsletters_Active_Campaign::get_merge_tags();
		$tags   = array_column( $result['tags'], 'tag' );
		$this->assertContains( '%FIRSTNAME%', $tags );
	}

	/**
	 * ActiveCampaign merge tags should include the %EMAIL% tag.
	 */
	public function test_active_campaign_merge_tags_includes_email() {
		$result = Newspack_Newsletters_Active_Campaign::get_merge_tags();
		$tags   = array_column( $result['tags'], 'tag' );
		$this->assertContains( '%EMAIL%', $tags );
	}

	/**
	 * ActiveCampaign merge tags should include the %UNSUBSCRIBELINK% tag.
	 */
	public function test_active_campaign_merge_tags_includes_unsubscribe() {
		$result = Newspack_Newsletters_Active_Campaign::get_merge_tags();
		$tags   = array_column( $result['tags'], 'tag' );
		$this->assertContains( '%UNSUBSCRIBELINK%', $tags );
	}

	/**
	 * Every entry in the ActiveCampaign merge tags dictionary must have tag and label keys.
	 */
	public function test_active_campaign_merge_tags_entries_have_required_keys() {
		$result = Newspack_Newsletters_Active_Campaign::get_merge_tags();
		$this->assertNotEmpty( $result['tags'] );
		foreach ( $result['tags'] as $entry ) {
			$this->assertArrayHasKey( 'tag', $entry );
			$this->assertArrayHasKey( 'label', $entry );
			$this->assertIsString( $entry['label'] );
			$this->assertNotEmpty( $entry['label'] );
			$this->assertIsString( $entry['tag'] );
			$this->assertNotEmpty( $entry['tag'] );
			$this->assertStringStartsWith( '%', $entry['tag'] );
			$this->assertStringEndsWith( '%', $entry['tag'] );
		}
	}
}

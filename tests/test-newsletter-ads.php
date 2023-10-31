<?php
/**
 * Test Newsletter Ads.
 *
 * @package Newspack_Newsletters
 */

/**
 * Newsletters Tracking Test.
 */
class Newsletters_Newsletter_Ads_Test extends WP_UnitTestCase {
	/**
	 * Ad ID for testing.
	 *
	 * @var int
	 */
	private static $ad_id = 0;

	/**
	 * Test creating ad.
	 */
	public function test_creating_ad() {
		self::$ad_id = self::factory()->post->create(
			[
				'post_type'    => Newspack_Newsletters_Ads::CPT,
				'post_title'   => 'A sample ad',
				'post_content' => '<!-- wp:paragraph -->\n<p>Ad content.<\/p>\n<!-- \/wp:paragraph -->',
			]
		);
		$this->assertNotEquals( 0, self::$ad_id );
	}

	/**
	 * Test active ad.
	 */
	public function test_is_active_ad() {
		$this->assertTrue( Newspack_Newsletters_Ads::is_ad_active( self::$ad_id ) );

		// Set start date to tomorrow.
		update_post_meta( self::$ad_id, 'start_date', dgmate( 'Y-m-d', strtotime( '+1 day' ) ) );
		$this->assertFalse( Newspack_Newsletters_Ads::is_ad_active( self::$ad_id ) );

		// Set start date to yesterday.
		update_post_meta( self::$ad_id, 'start_date', gmdate( 'Y-m-d', strtotime( '-1 day' ) ) );
		$this->assertTrue( Newspack_Newsletters_Ads::is_ad_active( self::$ad_id ) );

		// Set end date to yesterday.
		update_post_meta( self::$ad_id, 'end_date', gmdate( 'Y-m-d', strtotime( '-1 day' ) ) );
		$this->assertFalse( Newspack_Newsletters_Ads::is_ad_active( self::$ad_id ) );

		// Set end date to tomorrow.
		update_post_meta( self::$ad_id, 'end_date', gmdate( 'Y-m-d', strtotime( '+1 day' ) ) );
		$this->assertTrue( Newspack_Newsletters_Ads::is_ad_active( self::$ad_id ) );
	}
}

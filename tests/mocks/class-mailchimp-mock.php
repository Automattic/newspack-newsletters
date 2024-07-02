<?php // phpcs:ignore WordPress.Files.FileName

namespace DrewM\MailChimp;

/**
 * Mocks the MailChimp class.
 */
class MailChimp {
	private static $database = []; // phpcs:ignore Squiz.Commenting.VariableComment.Missing

	/**
	 * Initialize.
	 */
	public static function init() {
		self::$database = [
			'lists'   => [
				[
					'id'    => 'test-list-1',
					'name'  => 'Test List',
					'stats' => [ 'member_count' => 42 ],
				],
				[
					'id'    => 'test-list-2',
					'name'  => 'Test List 2',
					'stats' => [ 'member_count' => 21 ],
				],
			],
			'reports' => [
				[
					// Sent at 8am today – should be disregarded.
					'id'          => 'campaign-today',
					'emails_sent' => 121,
					'opens'       => [ 'unique_opens' => 131 ],
					'clicks'      => [ 'unique_subscriber_clicks' => 141 ],
					'send_time'   => gmdate( 'Y-m-d\T08:00:00P' ),
				],
				[
					// Sent at 8am yesterday.
					'id'          => 'campaign-yesterday',
					'emails_sent' => 12,
					'opens'       => [ 'unique_opens' => 13 ],
					'clicks'      => [ 'unique_subscriber_clicks' => 14 ],
					'send_time'   => gmdate( 'Y-m-d\T08:00:00P', strtotime( '-1 day' ) ),
				],
				[
					// Sent at 8am the day before yesterday.
					'id'          => 'campaign-day-before-yesterday',
					'emails_sent' => 22,
					'opens'       => [ 'unique_opens' => 23 ],
					'clicks'      => [ 'unique_subscriber_clicks' => 24 ],
					'send_time'   => gmdate( 'Y-m-d\T08:00:00P', strtotime( '-2 day' ) ),
				],
				[
					// Sent at 8am a week ago.
					'id'          => 'campaign-week-ago',
					'emails_sent' => 32,
					'opens'       => [ 'unique_opens' => 33 ],
					'clicks'      => [ 'unique_subscriber_clicks' => 34 ],
					'send_time'   => gmdate( 'Y-m-d\T08:00:00P', strtotime( '-7 day' ) ),
				],
			],
			'tags'    => [
				[
					'id'   => 42,
					'name' => 'Supertag',
				],
			],
			'members' => [
				[
					'id'            => '123',
					'contact_id'    => '123',
					'email_address' => 'test1@example.com',
					'full_name'     => 'Test User',
					'list_id'       => 'test-list',
					'status'        => 'subscribed',
				],
			],
		];
	}

	/**
	 * Add a member to the mock DB.
	 *
	 * @param array $contact Contact data.
	 */
	public static function mock_add_member( $contact ) {
		self::$database['members'][] = $contact;
	}

	public static function get( $endpoint, $args = [] ) { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		if ( preg_match( '/lists\/.*\/merge-fields/', $endpoint ) ) {
			return [
				'merge_fields' => [
					[
						'tag'  => 'FNAME',
						'name' => 'Name',
					],
				],
			];
		}
		if ( preg_match( '/lists\/.*\/tag-search/', $endpoint ) ) {
			return [
				'tags' => self::$database['tags'],
			];
		}
		if ( preg_match( '/lists\/.*\/activity/', $endpoint ) ) {
			$activity = [];
			for ( $day_index = 0; $day_index < $args['count']; $day_index++ ) {
				$activity[] = [
					'day'              => gmdate( 'Y-m-d', strtotime( "-$day_index day" ) ),
					// To accurately reflect MC API, the sent/opens/clicks data will be empty
					// for last 2 days.
					'emails_sent'      => 0,
					'unique_opens'     => 0,
					'recipient_clicks' => 0,
					// As many as the day index, just to be predictable.
					'subs'             => $day_index,
					'unsubs'           => $day_index,
				];
			}
			return [
				'activity' => $activity,
			];
		}
		switch ( $endpoint ) {
			case 'lists':
				return [
					'lists' => self::$database['lists'],
				];
			case 'search-members':
				$results = array_filter(
					self::$database['members'],
					function( $member ) use ( $args ) {
						return $member['email_address'] === $args['query'];
					}
				);
				return [ 'exact_matches' => [ 'members' => $results ] ];
			case 'reports':
				return [
					'reports' => self::$database['reports'],
				];
			default:
				return [];
		}
		return [];
	}

	public static function post( $endpoint, $args = [] ) { // phpcs:ignore Squiz.Commenting.FunctionComment.Missing
		if ( preg_match( '/lists\/.*\/merge-fields/', $endpoint ) ) {
			return [
				'status' => 200,
				'tag'    => 'FNAME',
			];
		}
		$members_endpoint = preg_match( '/lists\/(.*)\/members/', $endpoint, $matches );
		if ( $members_endpoint ) {
			$list_id = $matches[1];
			$result = [
				'status'  => 'pending',
				'list_id' => $list_id,
			];
			if ( isset( $args['tags'] ) && is_array( $args['tags'] ) ) {
				$result['tags'] = array_map(
					function( $tag_name ) {
						return [
							'id'   => 42,
							'name' => $tag_name,
						];
					},
					$args['tags']
				);
			}
			if ( isset( $args['interests'] ) && is_array( $args['interests'] ) ) {
				$result['interests'] = $args['interests'];
			}
			// Add tags and interests.
			return $result;
		}
		return [
			'status' => 200,
		];
	}
}
MailChimp::init();

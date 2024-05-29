<?php // phpcs:ignore WordPress.Files.FileName

namespace DrewM\MailChimp;

/**
 * Mocks the MailChimp class.
 */
class MailChimp {
	private static $database = [ // phpcs:ignore Squiz.Commenting.VariableComment.Missing
		'lists'   => [
			[
				'id'    => 'test-list-1',
				'name'  => 'Test List',
				'stats' => [ 'member_count' => 42 ],
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
					// As many as the day index, just to be predictable.
					'emails_sent'      => $day_index,
					'unique_opens'     => $day_index,
					'recipient_clicks' => $day_index,
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

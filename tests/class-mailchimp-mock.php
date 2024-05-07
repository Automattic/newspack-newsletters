<?php // phpcs:ignore WordPress.Files.FileName

namespace DrewM\MailChimp;

/**
 * Mocks the MailChimp class.
 */
class MailChimp {
	private static $database = [ // phpcs:ignore Squiz.Commenting.VariableComment.Missing
		'tags' => [
			[
				'id'   => 42,
				'name' => 'Supertag',
			],
		],
	];

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
		switch ( $endpoint ) {
			case 'search-members':
				return [ 'exact_matches' => [ 'members' => [] ] ];
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

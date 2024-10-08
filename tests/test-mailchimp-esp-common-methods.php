<?php // phpcs:ignore WordPress.Files.FileName.InvalidClassFileName
// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound
/**
 * Class Newsletters Test Mailchimp Usage Reports
 *
 * @package Newspack_Newsletters
 */

/**
 * Test Mailchimp Usage Reports.
 */
class MailchimpEspCommonMethodsTest extends Abstract_ESP_Tests {

	/**
	 * The current provider slug.
	 *
	 * @var string
	 */
	protected static $provider = 'mailchimp';

	/**
	 * Set up before class
	 */
	public static function set_up_before_class() {
		update_option( 'newspack_mailchimp_api_key', 'test-us' );
	}

	/**
	 * Tear down class
	 */
	public static function tear_down_after_class() {
		delete_option( 'newspack_mailchimp_api_key' );
	}

	/**
	 * Sets up the required filters for the get_contact_lists test
	 *
	 * @param string $email The email to search for.
	 * @return void
	 */
	public function set_up_test_get_contact_lists( $email ) {
		add_filter( 'mailchimp_mock_get', [ __CLASS__, 'get_contact_lists_mock_response' ], 10, 3 );
		self::$expected_endpoints_reached = [ 'GET: search-members' ];
	}

	/**
	 * Tears down the required filters for the get_contact_lists test
	 *
	 * @param string $email The email to search for.
	 * @return void
	 */
	public function tear_down_test_get_contact_lists( $email ) {
		remove_filter( 'mailchimp_mock_get', [ __CLASS__, 'get_contact_lists_mock_response' ], 10, 3 );
	}

	/**
	 * Mock responses
	 *
	 * @param array  $response The api response.
	 * @param string $endpoint The endpoint being called.
	 * @param array  $args The arguments passed to the endpoint.
	 * @return array
	 */
	public static function get_contact_lists_mock_response( $response, $endpoint, $args = [] ) {
		$expected_request = false;
		$base_member_response = [
			'full_name'     => 'Sample User',
			'list_id'       => 'list1',
			'email_address' => $args['query'] ?? '',
			'id'            => '123',
			'contact_id'    => '123',
			'status'        => 'subscribed',
		];
		$base_success_response = [
			'exact_matches' => [
				'members' => [],
			],
		];

		$response = false;

		if ( 'search-members' === $endpoint ) {
			if ( ! isset( $args['query'] ) ) {
				return $base_success_response;
			}

			if ( 'found-4@example.com' === $args['query'] ) {
				// Simulates a response of a contact with 2 lists.
				$expected_request = true;
				$response = $base_success_response;
				$response['exact_matches']['members'][] = $base_member_response;
				$response['exact_matches']['members'][0]['tags'] = [
					[
						'id'   => 'list2',
						'name' => 'list2',
					],
				];
				$response['exact_matches']['members'][] = $base_member_response;
				// Second Audience.
				$response['exact_matches']['members'][1]['list_id'] = 'list3';
				$response['exact_matches']['members'][1]['tags'] = [
					[
						'id'   => 'list4',
						'name' => 'list4',
					],
				];

			} elseif ( 'found@example.com' === $args['query'] ) {
				// Simulates a response of a contact with 2 lists.
				$expected_request = true;
				$response = $base_success_response;
				$response['exact_matches']['members'][] = $base_member_response;
				$response['exact_matches']['members'][0]['tags'] = [
					[
						'id'   => 'list2',
						'name' => 'list2',
					],
				];

			} elseif ( 'found-empty@example.com' === $args['query'] ) {
				// Simulates a response of a contact with zero lists.
				$expected_request = true;
				$response = $base_success_response;
				$response['exact_matches']['members'][] = $base_member_response;
				$response['exact_matches']['members'][0]['status'] = 'unsubscribed';

			} elseif ( 'not-found@example.com' === $args['query'] ) {
				// Simulates a response of a contact not found.
				$expected_request = true;
				$response = $base_success_response;

			} elseif ( 'failure@example.com' === $args['query'] ) {
				// Simulates an error response from the API.
				$expected_request = true;
				$response = [
					'type'     => 'https://mailchimp.com/developer/marketing/docs/errors/',
					'title'    => 'Resource Not Found',
					'status'   => 404,
					'detail'   => 'The requested resource could not be found.',
					'instance' => '995c5cb0-3280-4a6e-808b-3b096d0bb219',
				];
			}

			if ( $expected_request ) {
				self::$endpoints_reached[] = 'GET: search-members';
			}
		}
		return $response;
	}
}

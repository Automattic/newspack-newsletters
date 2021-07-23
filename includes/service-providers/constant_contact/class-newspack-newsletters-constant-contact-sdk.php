<?php
/**
 * Constant Contact Simple SDK
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

/**
 * Constant Contact Simple SDK for v3 API.
 */
final class Newspack_Newsletters_Constant_Contact_SDK {

	/**
	 * Base URI for API requests.
	 *
	 * @var string
	 */
	private $base_uri = 'https://api.cc.email/v3/';

	/**
	 * Base URI for Token requests.
	 *
	 * @var string
	 */
	private $token_base_uri = 'https://idfed.constantcontact.com/as/token.oauth2';

	/**
	 * Scope for API requests.
	 *
	 * @var string[]
	 */
	private $scope = [ 'account_read', 'contact_data', 'campaign_data' ];

	/**
	 * API Key
	 *
	 * @var string
	 */
	private $api_key;

	/**
	 * API Secret
	 *
	 * @var string
	 */
	private $api_secret;

	/**
	 * Access token
	 *
	 * @var string
	 */
	private $access_token;

	/**
	 * Client for making API requests.
	 *
	 * @var Client
	 */
	private $client;

	/**
	 * Perform API requests.
	 *
	 * @param string $method  Request method.
	 * @param string $path    Request path.
	 * @param array  $options Request options to apply. See \GuzzleHttp\RequestOptions.
	 *
	 * @throws Exception Error message.
	 * @return mixed
	 */
	private function request( $method, $path, $options = [] ) {
		$config = [
			'headers' => [
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
				'Authorization' => $this->access_token ? 'Bearer ' . $this->access_token : '',
			],
		];
		try {
			$response = $this->client->request( $method, $path, $config + $options );
			return json_decode( $response->getBody() );
		} catch ( RequestException $e ) {
			$body = json_decode( $e->getResponse()->getBody()->getContents() );
			if ( isset( $body[0] ) && isset( $body[0]->error_message ) ) {
				$message = $body[0]->error_message;
			} elseif ( isset( $body->error_message ) ) {
				$message = $body->error_message;
			} else {
				$message = $e->getMessage();
			}
			throw new Exception( 'Constant Contact: ' . $message );
		}
	}

	/**
	 * Class constructor.
	 *
	 * @param string $api_key      Api Key.
	 * @param string $api_secret   Api Secret.
	 * @param string $access_token Access token.
	 *
	 * @throws Exception Error message.
	 */
	public function __construct( $api_key, $api_secret, $access_token = '' ) {
		if ( ! $api_key ) {
			throw new Exception( 'API key is required.' );
		}
		if ( ! $api_secret ) {
			throw new Exception( 'API secret is required.' );
		}
		$this->api_key    = $api_key;
		$this->api_secret = $api_secret;

		if ( $access_token ) {
			$this->access_token = $access_token;
		}

		$this->client = new Client( [ 'base_uri' => $this->base_uri ] );
	}

	/**
	 * Get authorization code url
	 *
	 * @param string $redirect_uri Redirect URI.
	 *
	 * @return string
	 */
	public function get_auth_code_url( $redirect_uri = '' ) {
		return $this->base_uri . 'idfed?client_id=' . $this->api_key . '&scope=' . implode( '+', $this->scope ) . '&response_type=code&redirect_uri=' . urlencode( $redirect_uri );
	}

	/**
	 * Set access token
	 *
	 * @param string $access_token Access token.
	 */
	public function set_access_token( $access_token ) {
		$this->access_token = $access_token;
	}

	/**
	 * Validate access token
	 *
	 * @param string $access_token Access token.
	 *
	 * @return bool Wether the token is valid or not.
	 */
	public function validate_token( $access_token = '' ) {
		$access_token = $access_token ? $access_token : $this->access_token;
		if ( ! $access_token ) {
			return false;
		}
		try {
			$response = $this->request(
				'POST',
				'token_info',
				[ 'body' => wp_json_encode( [ 'token' => $access_token ] ) ]
			);
			return [] === array_diff( $this->scope, $response->scopes );
		} catch ( Exception $e ) {
			return false;
		}
	}

	/**
	 * Refresh access token.
	 *
	 * @param string $redirect_uri Redirect URI.
	 * @param string $code         Authorization code.
	 *
	 * @throws Exception Error message.
	 */
	public function get_access_token( $redirect_uri, $code ) {
		$credentials = base64_encode( $this->api_key . ':' . $this->api_secret );

		$options = [
			'query'   => [
				'code'         => $code,
				'grant_type'   => 'authorization_code',
				'redirect_uri' => $redirect_uri,
			],
			'headers' => [
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
				'Authorization' => 'Basic ' . $credentials,
			],
		];
		try {
			$response = $this->client->post( $this->token_base_uri, $options );
			return json_decode( $response->getBody() );
		} catch ( RequestException $e ) {
			throw new Exception( $e->getMessage() );
		}
	}

	/**
	 * Refresh access token.
	 *
	 * @param string $refresh_token Refresh token.
	 *
	 * @throws Exception Error message.
	 */
	public function refresh_token( $refresh_token ) {
		$credentials = base64_encode( $this->api_key . ':' . $this->api_secret );

		$options = [
			'query'   => [
				'refresh_token' => $refresh_token,
				'grant_type'    => 'refresh_token',
			],
			'headers' => [
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
				'Authorization' => 'Basic ' . $credentials,
			],
		];
		try {
			$response = $this->client->post( $this->token_base_uri, $options );
			return json_decode( $response->getBody() );
		} catch ( RequestException $e ) {
			throw new Exception( $e->getMessage() );
		}
	}

	/**
	 * Get Account info
	 *
	 * @return mixed
	 */
	public function get_account_info() {
		return $this->request(
			'GET',
			'account/summary',
			[ 'query' => [ 'extra_fields' => 'physical_address' ] ]
		);
	}

	/**
	 * Get account email addresses
	 *
	 * @return mixed
	 */
	public function get_email_addresses() {
		return $this->request( 'GET', 'account/emails' );
	}
	
	
	/**
	 * Get Contact Lists
	 *
	 * @return mixed
	 */
	public function get_contact_lists() {
		return $this->request(
			'GET',
			'contact_lists',
			[ 'query' => [ 'include_count' => 'true' ] ]
		)->lists;
	}

	/**
	 * Get v3 campaign UUID if matches v2 format.
	 *
	 * @param string $campaign_id Campaign ID.
	 *
	 * @return string Campaign ID.
	 */
	private function parse_campaign_id( $campaign_id ) {
		if (
			! preg_match(
				'/^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
				$campaign_id
			)
		) {
			$ids_res = $this->request(
				'GET',
				'emails/campaign_id_xrefs',
				[ 'query' => [ 'v2_email_campaign_ids' => $campaign_id ] ]
			);
			if ( $ids_res->xrefs && $ids_res->xrefs[0] && $ids_res->xrefs[0]->campaign_id ) {
				$campaign_id = $ids_res->xrefs[0]->campaign_id;
			}
		}
		return $campaign_id;
	}

	/**
	 * Get campaign data from v2 or v3 API
	 *
	 * @param string $campaign_id Campaign id.
	 * @return mixed
	 */
	public function get_campaign( $campaign_id ) {
		$campaign           = $this->request( 'GET', 'emails/' . $this->parse_campaign_id( $campaign_id ) );
		$activities         = array_values(
			array_filter(
				$campaign->campaign_activities,
				function( $activity ) {
					return 'primary_email' === $activity->role;
				}
			)
		);
		$activity_id        = $activities[0]->campaign_activity_id;
		$campaign->activity = $this->get_campaign_activity( $activity_id );

		return $campaign;
	}

	/**
	 * Get campaign activity.
	 * 
	 * @param string $campaign_activity_id Campaign Activity ID.
	 * 
	 * @return mixed
	 */
	public function get_campaign_activity( $campaign_activity_id ) {
		return $this->request( 'GET', 'emails/activities/' . $campaign_activity_id );
	}

	/**
	 * Update campaign name.
	 *
	 * @param string $campaign_id Campaign ID.
	 * @param string $name        Campaign name.
	 *
	 * @return mixed
	 */
	public function update_campaign_name( $campaign_id, $name ) {
		$campaign = $this->request(
			'PATCH',
			'emails/' . $this->parse_campaign_id( $campaign_id ),
			[ 'body' => wp_json_encode( [ 'name' => $name ] ) ]
		);
		return $this->get_campaign( $campaign->campaign_id );
	}

	/**
	 * Update campaign activity.
	 *
	 * @param string $campaign_activity_id Campaign Activity ID.
	 * @param string $data                 Campaign Activity Data.
	 *
	 * @return mixed
	 */
	public function update_campaign_activity( $campaign_activity_id, $data ) {
		return $this->request(
			'PUT',
			'emails/activities/' . $campaign_activity_id,
			[ 'body' => wp_json_encode( $data ) ]
		);
	}

	/**
	 * Create campaign
	 *
	 * @param array $data Campaign data.
	 *
	 * @return mixed
	 */
	public function create_campaign( $data ) {
		$campaign = $this->request(
			'POST',
			'emails',
			[ 'body' => wp_json_encode( $data ) ]
		);
		return $this->get_campaign( $campaign->campaign_id );
	}

	/**
	 * Delete campaign
	 *
	 * @param string $campaign_id Campaign ID.
	 *
	 * @return mixed
	 */
	public function delete_campaign( $campaign_id ) {
		return $this->request( 'DELETE', 'emails/' . $this->parse_campaign_id( $campaign_id ) );
	}

	/**
	 * Test send email
	 *
	 * @param string   $campaign_activity_id Campaign Activity ID.
	 * @param string[] $emails               Email addresses.
	 *
	 * @return mixed
	 */
	public function test_campaign( $campaign_activity_id, $emails ) {
		return $this->request(
			'POST',
			'emails/activities/' . $campaign_activity_id . '/tests',
			[ 'body' => wp_json_encode( [ 'email_addresses' => $emails ] ) ]
		);
	}

	/**
	 * Create campaign schedule
	 *
	 * @param string $campaign_activity_id Campaign Activity ID.
	 * @param string $date                 ISO-8601 Formatted date or '0' for immediately.
	 *
	 * @return mixed
	 */
	public function create_schedule( $campaign_activity_id, $date = '0' ) {
		return $this->request(
			'POST',
			'emails/activities/' . $campaign_activity_id . '/schedules',
			[ 'body' => wp_json_encode( [ 'scheduled_date' => $date ] ) ]
		);
	}

}

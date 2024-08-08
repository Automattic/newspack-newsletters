<?php
/**
 * Service Provider: Mailchimp Implementation
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

use DrewM\MailChimp\MailChimp;
use Newspack\Newsletters\Subscription_List;
use Newspack\Newsletters\Subscription_Lists;
use Newspack\Newsletters\Send_Lists;
use Newspack\Newsletters\Send_List;

/**
 * Main Newspack Newsletters Class.
 */
final class Newspack_Newsletters_Mailchimp extends \Newspack_Newsletters_Service_Provider {

	use Newspack_Newsletters_Mailchimp_Groups;

	/**
	 * Whether the provider has support to tags and tags based Subscription Lists.
	 *
	 * @var boolean
	 */
	public static $support_local_lists = true;

	/**
	 * Provider name.
	 *
	 * @var string
	 */
	public $name = 'Mailchimp';

	/**
	 * Cache of contact added on execution. Control to avoid adding the same
	 * contact multiple times due to optimistic nature of RAS.
	 *
	 * @var array[]
	 */
	private static $contacts_added = [];

	/**
	 * Controller.
	 *
	 * @var Newspack_Newsletters_Mailchimp_Controller
	 */
	public $controller;

	/**
	 * Class constructor.
	 */
	public function __construct() {
		$this->service    = 'mailchimp';
		$this->controller = new Newspack_Newsletters_Mailchimp_Controller( $this );
		Newspack_Newsletters_Mailchimp_Cached_Data::init();

		add_action( 'updated_post_meta', [ $this, 'save' ], 10, 4 );
		add_action( 'wp_trash_post', [ $this, 'trash' ], 10, 1 );
		add_filter( 'newspack_newsletters_process_link', [ $this, 'process_link' ], 10, 2 );

		add_action( 'newspack_newsletters_subscription_lists_metabox_after_tag', [ $this, 'lists_metabox_notice' ] );

		parent::__construct( $this );
	}

	/**
	 * Get configuration for conditional tag support.
	 *
	 * @return array
	 */
	public static function get_conditional_tag_support() {
		return [
			'support_url' => 'https://mailchimp.com/help/use-conditional-merge-tag-blocks/',
			'example'     => [
				'before' => '*|IF:FNAME|*',
				'after'  => '*|END:IF|*',
			],
		];
	}

	/**
	 * Get API credentials for service provider.
	 *
	 * @return Object Stored API credentials for the service provider.
	 */
	public function api_credentials() {
		return [
			// 'newspack_mailchimp_api_key' is a new option introduced to manage MC API key accross Newspack plugins.
			// Keeping the old option for backwards compatibility.
			'api_key' => get_option( 'newspack_mailchimp_api_key', get_option( 'newspack_newsletters_mailchimp_api_key', '' ) ),
		];
	}

	/**
	 * Check if provider has all necessary credentials set.
	 *
	 * @return Boolean Result.
	 */
	public function has_api_credentials() {
		return ! empty( $this->api_key() );
	}

	/**
	 * Get API key for service provider.
	 *
	 * @return String Stored API key for the service provider.
	 */
	public function api_key() {
		$credentials = self::api_credentials();
		return $credentials['api_key'];
	}

	/**
	 * Set the API credentials for the service provider.
	 *
	 * @param object $credentials API credentials.
	 */
	public function set_api_credentials( $credentials ) {
		$api_key = $credentials['api_key'];
		if ( empty( $api_key ) ) {
			return new WP_Error(
				'newspack_newsletters_invalid_keys',
				__( 'Please input a Mailchimp API key.', 'newspack-newsletters' )
			);
		}
		try {
			$mc   = new Mailchimp( $api_key );
			$ping = $mc->get( 'ping' );
		} catch ( Exception $e ) {
			$ping = null;
		}
		return $ping ?
			update_option( 'newspack_mailchimp_api_key', $api_key ) :
			new WP_Error(
				'newspack_newsletters_invalid_keys',
				__( 'Please input a valid Mailchimp API key.', 'newspack-newsletters' )
			);
	}

	/**
	 * Retrieve the ESP's tag ID from its name
	 *
	 * @param string  $tag_name The tag.
	 * @param boolean $create_if_not_found Whether to create a new tag if not found. Default to true.
	 * @param string  $list_id The List ID.
	 * @return int|WP_Error The tag ID on success. WP_Error on failure.
	 */
	public function get_tag_id( $tag_name, $create_if_not_found = true, $list_id = null ) {
		$mc     = new Mailchimp( $this->api_key() );
		$search = $mc->get(
			sprintf( 'lists/%s/tag-search', $list_id ),
			[
				'name' => $tag_name,
			]
		);
		if ( ! empty( $search['total_items'] ) ) {
			foreach ( $search['tags'] as $found_tag ) {
				// tag-search is case insensitive.
				if ( strtolower( $tag_name ) === strtolower( $found_tag['name'] ) ) {
					return $found_tag['id'];
				}
			}
		}

		// Tag was not found.
		if ( ! $create_if_not_found ) {
			return new WP_Error(
				'newspack_newsletter_tag_not_found'
			);
		}

		$created = $this->create_tag( $tag_name, $list_id );

		if ( is_wp_error( $created ) ) {
			return $created;
		}

		return (int) $created['id'];
	}

	/**
	 * Retrieve the ESP's tag name from its ID
	 *
	 * @param int    $tag_id The tag ID.
	 * @param string $list_id The List ID.
	 * @return string|WP_Error The tag name on success. WP_Error on failure.
	 */
	public function get_tag_by_id( $tag_id, $list_id = null ) {
		$mc     = new Mailchimp( $this->api_key() );
		$search = $mc->get(
			sprintf( 'lists/%s/segments/%d', $list_id, $tag_id )
		);
		if ( ! empty( $search['name'] ) ) {
			return $search['name'];
		}
		return new WP_Error(
			'newspack_newsletter_tag_not_found'
		);
	}

	/**
	 * Create a Tag on the provider
	 *
	 * @param string $tag The Tag name.
	 * @param string $list_id The List ID.
	 * @return array|WP_Error The tag representation sent from the server on succes. WP_Error on failure.
	 */
	public function create_tag( $tag, $list_id = null ) {

		$mc      = new Mailchimp( $this->api_key() );
		$created = $mc->post(
			sprintf( 'lists/%s/segments', $list_id ),
			[
				'name'           => $tag,
				'static_segment' => [],
			]
		);

		if ( is_array( $created ) && ! empty( $created['id'] ) && ! empty( $created['name'] ) ) {
			return $created;
		}
		return new WP_Error(
			'newspack_newsletters_error_creating_tag',
			! empty( $created['detail'] ) ? $created['detail'] : ''
		);
	}

	/**
	 * Updates a Tag name on the provider
	 *
	 * @param string|int $tag_id The tag ID.
	 * @param string     $tag The Tag new name.
	 * @param string     $list_id The List ID.
	 * @return array|WP_Error The tag representation with at least 'id' and 'name' keys on succes. WP_Error on failure.
	 */
	public function update_tag( $tag_id, $tag, $list_id = null ) {
		$mc      = new Mailchimp( $this->api_key() );
		$created = $mc->patch(
			sprintf( 'lists/%s/segments/%s', $list_id, $tag_id ),
			[
				'name'           => $tag,
				'static_segment' => [],
			]
		);

		if ( is_array( $created ) && ! empty( $created['id'] ) && ! empty( $created['name'] ) ) {
			return $created;
		}
		return new WP_Error(
			'newspack_newsletters_error_updating_tag',
			! empty( $created['detail'] ) ? $created['detail'] : ''
		);
	}

	/**
	 * Add a tag to a contact
	 *
	 * @param string     $email The contact email.
	 * @param string|int $tag The tag ID.
	 * @param string     $list_id The List ID.
	 * @return true|WP_Error
	 */
	public function add_tag_to_contact( $email, $tag, $list_id = null ) {
		$existing_contact = $this->get_contact_data( $email );
		if ( is_wp_error( $existing_contact ) ) {
			return $existing_contact;
		}
		$mc      = new Mailchimp( $this->api_key() );
		$created = $mc->post(
			sprintf( 'lists/%s/segments/%d', $list_id, $tag ),
			[
				'members_to_add' => [ $email ],
			]
		);

		if ( is_array( $created ) && ! empty( $created['members_added'] ) ) {
			return true;
		}

		return new WP_Error(
			'newspack_newsletter_error_adding_tag_to_contact',
			! empty( $created['errors'] ) && ! empty( $created['errors'][0]['error'] ) ? $created['errors'][0]['error'] : ''
		);
	}

	/**
	 * Remove a tag from a contact
	 *
	 * @param string     $email The contact email.
	 * @param string|int $tag The tag ID.
	 * @param string     $list_id The List ID.
	 * @return true|WP_Error
	 */
	public function remove_tag_from_contact( $email, $tag, $list_id = null ) {
		$existing_contact = $this->get_contact_data( $email );
		if ( is_wp_error( $existing_contact ) ) {
			return $existing_contact;
		}
		$mc      = new Mailchimp( $this->api_key() );
		$created = $mc->post(
			sprintf( 'lists/%s/segments/%d', $list_id, $tag ),
			[
				'members_to_remove' => [ $email ],
			]
		);

		if ( is_array( $created ) && ! empty( $created['members_removed'] ) ) {
			return true;
		}

		return new WP_Error(
			'newspack_newsletter_error_adding_tag_to_contact',
			! empty( $created['errors'] ) && ! empty( $created['errors'][0]['error'] ) ? $created['errors'][0]['error'] : ''
		);
	}

	/**
	 * Set folder for a campaign.
	 *
	 * @param string $post_id Campaign Id.
	 * @param string $folder_id ID of the folder.
	 * @return object|WP_Error API API Response or error.
	 */
	public function folder( $post_id, $folder_id ) {
		$mc_campaign_id = get_post_meta( $post_id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		try {
			$mc      = new Mailchimp( $this->api_key() );
			$payload = [
				'settings' => [
					'folder_id' => $folder_id,
				],
			];
			$result  = $mc->patch( sprintf( 'campaigns/%s', $mc_campaign_id ), $payload );

			$data = $this->retrieve( $post_id );
			if ( is_wp_error( $data ) ) {
				return \rest_ensure_response( $data );
			}

			$data['result'] = $result;
			return \rest_ensure_response( $data );
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_error_setting_folder',
				$e->getMessage()
			);
		}
	}

	/**
	 * Set list for a campaign.
	 *
	 * @param string $post_id Campaign Id.
	 * @param string $list_id ID of the list.
	 * @return object|WP_Error API API Response or error.
	 */
	public function list( $post_id, $list_id ) {
		$mc_campaign_id = get_post_meta( $post_id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		try {
			$mc      = new Mailchimp( $this->api_key() );
			$payload = [
				'recipients' => [
					'list_id' => $list_id,
				],
			];
			$result  = $this->validate(
				$mc->patch( "campaigns/$mc_campaign_id", $payload ),
				__( 'Error setting Mailchimp list.', 'newspack_newsletters' )
			);

			$data = $this->retrieve( $post_id );
			if ( is_wp_error( $data ) ) {
				return \rest_ensure_response( $data );
			}

			$data['result'] = $result;

			return \rest_ensure_response( $data );
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$e->getMessage()
			);
		}
	}

	/**
	 * Retrieve a campaign.
	 *
	 * @param integer $post_id Numeric ID of the Newsletter post.
	 * @return object|WP_Error API Response or error.
	 */
	public function retrieve( $post_id ) {
		if ( ! $this->has_api_credentials() ) {
			return [];
		}
		try {
			$mc_campaign_id = get_post_meta( $post_id, 'mc_campaign_id', true );
			if ( ! $mc_campaign_id ) {
				$this->sync( get_post( $post_id ) );
			}
			$mc                  = new Mailchimp( $this->api_key() );
			$campaign            = $this->validate(
				$mc->get(
					"campaigns/$mc_campaign_id",
					[
						'fields' => 'id,type,status,emails_sent,content_type,recipients,settings',
					]
				),
				__( 'Error retrieving Mailchimp campaign.', 'newspack_newsletters' )
			);
			$list_id = $campaign && isset( $campaign['recipients']['list_id'] ) ? $campaign['recipients']['list_id'] : null;

			$lists = $this->get_lists( true );
			if ( \is_wp_error( $lists ) ) {
				return $lists;
			}

			$newsletter_data = [
				'campaign'     => $campaign,
				'campaign_id'  => $mc_campaign_id,
				'folders'      => Newspack_Newsletters_Mailchimp_Cached_Data::get_folders(),
				'merge_fields' => $list_id ? Newspack_Newsletters_Mailchimp_Cached_Data::get_merge_fields( $list_id ) : [],
			];

			// Check for past sync errors.
			$sync_errors = get_post_meta( $post_id, 'newsletter_sync_errors', true );
			if ( $sync_errors ) {
				$newsletter_data['sync_errors'] = array_map(
					function( $sync_error ) {
						return [
							'timestamp' => $sync_error['timestamp'],
							'message'   => $sync_error['message'],
						];
					},
					$sync_errors
				);
			}

			return $newsletter_data;
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$e->getMessage()
			);
		}
	}

	/**
	 * Get audiences, groups, and tags that can be configured as subscription lists.
	 * Reconcile edited names for locally-configured lists.
	 *
	 * @param boolean $audiences_only Whether to include groups and tags. If true, only return audiences.
	 *
	 * @return array|WP_Error List of subscription lists or error.
	 */
	public function get_lists( $audiences_only = false ) {
		$lists = Newspack_Newsletters_Mailchimp_Cached_Data::get_lists();
		if ( $audiences_only || is_wp_error( $lists ) ) {
			return $lists;
		}

		// In addition to Audiences, we also automatically fetch all groups and tags and offer them as Subscription Lists.
		// Build the final list inside the loop so groups are added after the list they belong to and we can then represent the hierarchy in the UI.
		foreach ( $lists as $list ) {

			$lists[]        = $list;
			$all_categories = Newspack_Newsletters_Mailchimp_Cached_Data::get_interest_categories( $list['id'] );
			$all_categories = $all_categories['categories'] ?? [];
			$all_tags       = Newspack_Newsletters_Mailchimp_Cached_Data::get_tags( $list['id'] ) ?? [];

			foreach ( $all_categories as $found_category ) {

				// Do not include groups under the category we use to store "Local" lists.
				if ( $this->get_group_category_name() === $found_category['title'] ) {
					continue;
				}

				$all_groups = $found_category['interests'] ?? [];

				$groups = array_map(
					function ( $group ) use ( $list ) {
						$group['id']   = $this->create_group_or_tag_list_id( $group['id'], $list['id'] );
						$group['type'] = 'mailchimp-group';
						return $group;
					},
					$all_groups['interests'] ?? [] // Yes, two levels of 'interests'.
				);
				$lists  = array_merge( $lists, $groups );
			}

			foreach ( $all_tags as $tag ) {
				$tag['id']   = $this->create_group_or_tag_list_id( $tag['id'], $list['id'], 'tag' );
				$tag['type'] = 'mailchimp-tag';
				$lists[]     = $tag;
			}
		}

		// Reconcile edited names for locally-configured lists.
		$configured_lists = Newspack_Newsletters_Subscription::get_lists_config();
		if ( ! empty( $configured_lists ) ) {
			foreach ( $lists as &$list ) {
				if ( ! empty( $configured_lists[ $list['id'] ]['name'] ) ) {
					$list['local_name'] = $configured_lists[ $list['id'] ]['name'];
				}
			}
		}

		return $lists;
	}

	/**
	 * Get all applicable audiences, groups, tags, and segments as Send_List objects.
	 *
	 * @param string $search Optional. If given, only return lists whose names or entity types match the search string.
	 * @param string $list_type Optional: list or sublist. If given, only return Send Lists of the specified type.
	 * @param string $parent_id Optional: If given, only return sublists of the specified parent list.
	 *
	 * @return Send_List[]|WP_Error Array of Send_List objects on success, or WP_Error object on failure.
	 */
	public function get_send_lists( $search = '', $list_type = null, $parent_id = null ) {
		$audiences  = $this->get_lists( true );
		$send_lists = [];

		foreach ( $audiences as $audience ) {
			$entity_type = __( 'Audience', 'newspack-newsletters' );
			if ( ( ! $list_type || 'list' === $list_type ) && self::matches_search( $search, [ $audience['id'], $audience['name'], $entity_type ] ) ) {
				$send_lists[] = new Send_List(
					[
						'provider'    => $this->service,
						'type'        => 'list',
						'id'          => $audience['id'],
						'name'        => $audience['name'],
						'entity_type' => $entity_type,
						'count'       => $audience['stats']['member_count'] ?? 0,
					]
				);
			}

			if ( $list_type && 'sublist' !== $list_type ) {
				continue;
			}

			$groups = $this->get_interest_categories( $parent_id ?? $audience['id'] );
			if ( isset( $groups['categories'] ) ) {
				$entity_type = __( 'Group', 'newspack-newsletters' );
				foreach ( $groups['categories'] as $category ) {
					if ( isset( $category['interests']['interests'] ) ) {
						foreach ( $category['interests']['interests'] as $interest ) {
							if ( self::matches_search( $search, [ $interest['id'], $interest['name'], $$entity_type ] ) ) {
								$send_lists[] = new Send_List(
									[
										'provider'    => $this->service,
										'type'        => 'sublist',
										'id'          => $interest['id'],
										'name'        => $interest['name'],
										'entity_type' => $entity_type,
										'parent'      => $interest['list_id'],
										'count'       => $interest['subscriber_count'],
									]
								);
							}
						}
					}
				}
			}

			$tags = $this->get_tags( $parent_id ?? $audience['id'] );
			foreach ( $tags as $tag ) {
				$entity_type = __( 'Tag', 'newspack-newsletters' );
				if ( self::matches_search( $search, [ $tag['id'], $interest['name'], $tag['local_name'], $$entity_type ] ) ) {
					$tag_config = [
						'provider'    => $this->service,
						'type'        => 'sublist',
						'id'          => $tag['id'],
						'name'        => $tag['name'],
						'entity_type' => $entity_type,
						'parent'      => $tag['list_id'],
						'count'       => $tag['member_count'],
					];
					if ( isset( $tag['local_name'] ) ) {
						$tag_config['local_name'] = $tag['local_name'];
					}
					$send_lists[] = new Send_List( $tag_config );
				}
			}

			$segments = Newspack_Newsletters_Mailchimp_Cached_Data::get_segments( $parent_id ?? $audience['id'] );
			foreach ( $segments as $segment ) {
				if ( ! $search || stripos( $segment['name'], $search ) !== false || stripos( 'segment', $search ) !== false ) {
					$send_lists[] = new Send_List(
						[
							'provider'    => $this->service,
							'type'        => 'sublist',
							'id'          => $segment['id'],
							'name'        => $segment['name'],
							'entity_type' => 'segment',
							'parent'      => $segment['list_id'],
							'count'       => $segment['member_count'],
						]
					);
				}
			}
		}

		return $send_lists;
	}

	/**
	 * Get interest categories and their groups.
	 * Reconcile edited names for locally-configured lists.
	 *
	 * @param string $list_id List ID.
	 *
	 * @return array
	 */
	public function get_interest_categories( $list_id = null ) {
		if ( ! $list_id ) {
			return [];
		}
		$categories = Newspack_Newsletters_Mailchimp_Cached_Data::get_interest_categories( $list_id );
		if ( empty( $categories['categories'] ) ) {
			return [];
		}

		// Reconcile edited names for locally-configured lists.
		$configured_lists = Newspack_Newsletters_Subscription::get_lists_config();
		if ( ! empty( $configured_lists ) ) {
			foreach ( $categories['categories'] as &$category ) {
				if ( ! empty( $category['interests']['interests'] ) ) {
					foreach ( $category['interests']['interests'] as &$interest ) {
						$local_id = $this->create_group_or_tag_list_id( $interest['id'], $list_id );
						if ( isset( $configured_lists[ $local_id ]['name'] ) ) {
							$interest['local_name'] = $configured_lists[ $local_id ]['name'];
						}
					}
				}
			}
		}

		return $categories;
	}

	/**
	 * Get tags. Reconcile edited names for locally-configured lists.
	 *
	 * @param string $list_id List ID.
	 *
	 * @return array
	 */
	public function get_tags( $list_id = null ) {
		if ( ! $list_id ) {
			return [];
		}
		$tags = Newspack_Newsletters_Mailchimp_Cached_Data::get_tags( $list_id );
		if ( empty( $tags ) ) {
			return [];
		}

		// Reconcile edited names for locally-configured lists.
		$configured_lists = Newspack_Newsletters_Subscription::get_lists_config();
		if ( ! empty( $configured_lists ) ) {
			foreach ( $tags as &$tag ) {
				$local_id = $this->create_group_or_tag_list_id( $tag['id'], $list_id, 'tag' );
				if ( isset( $configured_lists[ $local_id ]['name'] ) ) {
					$tag['local_name'] = $configured_lists[ $local_id ]['name'];
				}
			}
		}

		return $tags;
	}

	/**
	 * Retrieve the list merge fields.
	 *
	 * @deprecated 1.57
	 *
	 * @param string $list_id List ID.
	 *
	 * @return array|WP_Error List of merge fields or error.
	 */
	public function get_list_merge_fields( $list_id ) {
		_deprecated_function( __METHOD__, '1.57', 'Newspack_Newsletters_Mailchimp_Cached_Data::get_merge_fields' );
		try {
			$merge_fields = Newspack_Newsletters_Mailchimp_Cached_Data::get_merge_fields( $list_id );
			return $merge_fields;
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$e->getMessage()
			);
		}
	}

	/**
	 * Set sender data.
	 *
	 * @param string $post_id Numeric ID of the campaign.
	 * @param string $from_name Sender name.
	 * @param string $reply_to Reply to email address.
	 * @return object|WP_Error API Response or error.
	 */
	public function sender( $post_id, $from_name, $reply_to ) {
		$mc_campaign_id = get_post_meta( $post_id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}
		try {
			$mc = new Mailchimp( $this->api_key() );

			$result = $this->validate(
				$mc->get( 'verified-domains', [ 'count' => 1000 ] ),
				__( 'Error retrieving verified domains from Mailchimp.', 'newspack-newsletters' )
			);

			$verified_domains = array_filter(
				array_map(
					function ( $domain ) {
						return $domain['verified'] ? strtolower( trim( $domain['domain'] ) ) : null;
					},
					$result['domains']
				),
				function ( $domain ) {
					return ! empty( $domain );
				}
			);

			$explode = explode( '@', $reply_to );
			$domain  = strtolower( trim( array_pop( $explode ) ) );

			if ( ! in_array( $domain, $verified_domains ) ) {
				return new WP_Error(
					'newspack_newsletters_unverified_sender_domain',
					sprintf(
					// Translators: explanation that current domain is not verified, list of verified options.
						__( '%1$s is not a verified domain. Verified domains for the linked Mailchimp account are: %2$s.', 'newspack-newsletters' ),
						$domain,
						implode( ', ', $verified_domains )
					)
				);
			}

			$settings = [];
			if ( $from_name ) {
				$settings['from_name'] = $from_name;
			}
			if ( $reply_to ) {
				$settings['reply_to'] = $reply_to;
			}
			$payload = [
				'settings' => $settings,
			];
			$result  = $this->validate(
				$mc->patch( "campaigns/$mc_campaign_id", $payload ),
				__( 'Error setting sender name and email.', 'newspack_newsletters' )
			);

			$data           = $this->retrieve( $post_id );
			$data['result'] = $result;

			return \rest_ensure_response( $data );
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$e->getMessage()
			);
		}
	}

	/**
	 * Send test email or emails.
	 *
	 * @param integer $post_id Numeric ID of the Newsletter post.
	 * @param array   $emails Array of email addresses to send to.
	 * @return object|WP_Error API Response or error.
	 */
	public function test( $post_id, $emails ) {
		$mc_campaign_id = get_post_meta( $post_id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}
		try {

			$sync_result = $this->sync( get_post( $post_id ) );
			if ( ! $sync_result ) {
				return new WP_Error(
					'newspack_newsletters_mailchimp_error',
					__( 'Unable to synchronize with Mailchimp.', 'newspack-newsletters' )
				);
			}
			if ( is_wp_error( $sync_result ) ) {
				return $sync_result;
			}

			$mc      = new Mailchimp( $this->api_key() );
			$payload = [
				'test_emails' => $emails,
				'send_type'   => 'html',
			];
			$result  = $this->validate(
				$mc->post(
					"campaigns/$mc_campaign_id/actions/test",
					$payload,
					60
				),
				__( 'Error sending test email.', 'newspack_newsletters' )
			);

			$data            = $this->retrieve( $post_id );
			$data['result']  = $result;
			$data['message'] = sprintf(
			// translators: Message after successful test email.
				__( 'Mailchimp test sent successfully to %s.', 'newspack-newsletters' ),
				implode( ', ', $emails )
			);

			return \rest_ensure_response( $data );
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$this->get_better_error_message( $e->getMessage() )
			);
		}
	}

	/**
	 * Synchronize post with corresponding ESP campaign.
	 *
	 * @param WP_Post $post Post to synchronize.
	 *
	 * @return object|WP_Error API Response or error.
	 *
	 * @throws Exception Error message.
	 */
	public function sync( $post ) {
		try {
			$api_key = $this->api_key();
			if ( ! $api_key ) {
				throw new Exception( __( 'No Mailchimp API key available.', 'newspack-newsletters' ) );
			}
			if ( empty( $post->post_title ) ) {
				throw new Exception( __( 'The newsletter subject cannot be empty.', 'newspack-newsletters' ) );
			}
			$mc             = new Mailchimp( $api_key );
			$payload        = [
				'type'         => 'regular',
				'content_type' => 'template',
				'settings'     => [
					'subject_line' => $post->post_title,
					'title'        => $this->get_campaign_name( $post ),
				],
			];
			$mc_campaign_id = get_post_meta( $post->ID, 'mc_campaign_id', true );

			/**
			 * Filter the metadata payload sent to Mailchimp when syncing.
			 *
			 * Allows custom tracking codes to be sent.
			 *
			 * @param array  $payload        Mailchimp payload.
			 * @param object $post           Post object.
			 * @param string $mc_campaign_id Mailchimp campaign ID, if defined.
			 */
			$payload = apply_filters( 'newspack_newsletters_mc_payload_sync', $payload, $post, $mc_campaign_id );

			if ( $mc_campaign_id ) {
				$campaign_result = $this->validate(
					$mc->patch( "campaigns/$mc_campaign_id", $payload ),
					__( 'Error updating campaign title.', 'newspack_newsletters' )
				);
			} else {
				$campaign_result = $this->validate(
					$mc->post( 'campaigns', $payload ),
					__( 'Error setting campaign title.', 'newspack_newsletters' )
				);
				$mc_campaign_id  = $campaign_result['id'];
				update_post_meta( $post->ID, 'mc_campaign_id', $mc_campaign_id );
			}

			// Prevent updating content of a sent campaign.
			if ( in_array( $campaign_result['status'], [ 'sent', 'sending' ] ) ) {
				return;
			}

			$renderer        = new Newspack_Newsletters_Renderer();
			$content_payload = [
				'html' => $renderer->retrieve_email_html( $post ),
			];

			$content_result = $this->validate(
				$mc->put( "campaigns/$mc_campaign_id/content", $content_payload ),
				__( 'Error updating campaign content.', 'newspack_newsletters' )
			);

			// Retrieve and store campaign data.
			$data = $this->retrieve( $post->ID );
			if ( ! is_wp_error( $data ) ) {
				update_post_meta( $post->ID, 'newsletterData', $data );
			}

			return [
				'campaign_result' => $campaign_result,
				'content_result'  => $content_result,
			];
		} catch ( Exception $e ) {
			$errors = get_post_meta( $post->ID, 'newsletter_sync_errors', true );
			if ( ! is_array( $errors ) ) {
				$errors = [];
			}
			$error_message = __( 'Error syncing with Mailchimp campaign: ', 'newspack-newsletters' ) . $e->getMessage();
			$errors[] = [
				'timestamp' => time(),
				'message'   => $error_message,
			];
			$errors   = array_slice( $errors, -10, 10, true );
			update_post_meta( $post->ID, 'newsletter_sync_errors', $errors );
			return new WP_Error( 'newspack_newsletters_mailchimp_error', $e->getMessage() );
		}
	}

	/**
	 * Update ESP campaign after refreshing the email HTML, which is triggered by post save.
	 *
	 * @param int   $meta_id Numeric ID of the meta field being updated.
	 * @param int   $post_id The post ID for the meta field being updated.
	 * @param mixed $meta_key The meta key being updated.
	 */
	public function save( $meta_id, $post_id, $meta_key ) {
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( Newspack_Newsletters::EMAIL_HTML_META !== $meta_key ) {
			return;
		}
		$post = get_post( $post_id );
		if ( ! Newspack_Newsletters_Editor::is_editing_email( $post_id ) ) {
			return;
		}
		if ( 'trash' === $post->post_status ) {
			return;
		}
		$this->sync( $post );
	}

	/**
	 * Send a campaign.
	 *
	 * @param WP_Post $post Post to send.
	 *
	 * @return true|WP_Error True if the campaign was sent or error if failed.
	 */
	public function send( $post ) {
		$post_id = $post->ID;

		// Check if campaign has already been sent and if so, don't attempt to
		// send again.
		$campaign_data = $this->retrieve( $post_id );
		if ( is_wp_error( $campaign_data ) ) {
			return $campaign_data;
		}
		if (
				isset( $campaign_data['campaign']['status'] ) &&
				in_array( $campaign_data['campaign']['status'], [ 'sent', 'sending' ], true )
			) {
			return true;
		}

		$sync_result = $this->sync( $post );

		if ( is_wp_error( $sync_result ) ) {
			return $sync_result;
		}

		if ( ! $sync_result ) {
			return new WP_Error(
				'newspack_newsletters_error',
				__( 'Unable to synchronize with Mailchimp.', 'newspack-newsletters' )
			);
		}

		$mc_campaign_id = get_post_meta( $post_id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_error',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		$mc = new Mailchimp( $this->api_key() );

		$payload = [
			'send_type' => 'html',
		];
		try {
			$this->validate(
				$mc->post( "campaigns/$mc_campaign_id/actions/send", $payload ),
				__( 'Error sending campaign.', 'newspack_newsletters' )
			);
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_error',
				$e->getMessage()
			);
		}

		return true;
	}

	/**
	 * After Newsletter post is deleted, clean up by deleting corresponding ESP campaign.
	 *
	 * @param string $post_id Numeric ID of the campaign.
	 */
	public function trash( $post_id ) {
		if ( Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT !== get_post_type( $post_id ) ) {
			return;
		}
		$mc_campaign_id = get_post_meta( $post_id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return;
		}

		$api_key = $this->api_key();
		if ( ! $api_key ) {
			return;
		}
		try {
			$mc       = new Mailchimp( $api_key );
			$campaign = $mc->get( "campaigns/$mc_campaign_id" );
			if ( $campaign ) {
				$status = $campaign['status'];
				if ( ! in_array( $status, [ 'sent', 'sending' ] ) ) {
					$result = $mc->delete( "campaigns/$mc_campaign_id" );
					delete_post_meta( $post_id, 'mc_campaign_id', $mc_campaign_id );
				}
			}
		} catch ( Exception $e ) {
			return; // Fail silently.
		}
	}

	/**
	 * Set Mailchimp Audience segments for a Campaign.
	 *
	 * @param string     $post_id   Numeric ID of the post.
	 * @param string|int $target_id Segment/tag ID or compound interest ID (field name and ID).
	 *
	 * @return object|WP_Error API API Response or error.
	 */
	public function audience_segments( $post_id, $target_id ) {

		$interest_id = false;
		$segment_id  = false;

		// Determine if we're dealing with an interest or a segment.
		if ( false !== strpos( $target_id, ':' ) ) {
			$exploded    = explode( ':', $target_id );
			$field       = count( $exploded ) ? $exploded[0] : null;
			$interest_id = count( $exploded ) > 1 ? $exploded[1] : null;
		} elseif ( '' !== $target_id ) {
			$segment_id = $target_id;
		}

		$mc_campaign_id = get_post_meta( $post_id, 'mc_campaign_id', true );
		if ( ! $mc_campaign_id ) {
			return new WP_Error(
				'newspack_newsletters_no_campaign_id',
				__( 'Mailchimp campaign ID not found.', 'newspack-newsletters' )
			);
		}

		if ( '' !== $target_id && ! $interest_id && ! $segment_id ) {
			return new WP_Error(
				'newspack_newsletters_invalid_mailchimp_interest',
				__( 'Invalid Mailchimp Interest.', 'newspack-newsletters' )
			);
		}

		try {
			$mc       = new Mailchimp( $this->api_key() );
			$campaign = $this->validate(
				$mc->get( "campaigns/$mc_campaign_id" ),
				__( 'Error retrieving Mailchimp campaign.', 'newspack_newsletters' )
			);
			$list_id  = isset( $campaign, $campaign['recipients'], $campaign['recipients']['list_id'] ) ? $campaign['recipients']['list_id'] : null;

			if ( ! $list_id ) {
				return new WP_Error(
					'newspack_newsletters_no_campaign_id',
					__( 'Mailchimp list ID not found.', 'newspack-newsletters' )
				);
			}

			$segment_opts = (object) [];

			if ( $interest_id ) {
				$segment_opts = [
					'match'      => 'all',
					'conditions' => [
						[
							'condition_type' => 'Interests',
							'field'          => $field,
							'op'             => 'interestcontains',
							'value'          => [ $interest_id ],
						],
					],
				];
			} elseif ( $segment_id ) {
				$segment_data = $mc->get( "lists/$list_id/segments/$segment_id" );
				if ( 'static' === $segment_data['type'] ) {
					// Handle static segments (tags).
					$segment_opts = [
						'match'      => 'all',
						'conditions' => [
							[
								'condition_type' => 'StaticSegment',
								'field'          => 'static_segment',
								'op'             => 'static_is',
								'value'          => $segment_id,
							],
						],
					];
				} elseif ( 'saved' === $segment_data['type'] ) {
					// Handle saved segments.
					$segment_opts = $segment_data['options'];
				}
			}

			$payload = [
				'recipients' => [
					'list_id'      => $list_id,
					'segment_opts' => $segment_opts,
				],
			];

			// Add saved segment ID to payload if present.
			if ( ! empty( $segment_data ) && 'saved' === $segment_data['type'] ) {
				$payload['recipients']['segment_opts']['saved_segment_id'] = (int) $segment_id;
			}

			$result = $this->validate(
				$mc->patch( "campaigns/$mc_campaign_id", $payload ),
				__( 'Error updating Mailchimp segments.', 'newspack_newsletters' )
			);

			$data           = $this->retrieve( $post_id );
			$data['result'] = $result;

			return \rest_ensure_response( $data );
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$e->getMessage()
			);
		}
	}

	/**
	 * Throw an Exception if Mailchimp response indicates an error.
	 *
	 * @param Object $result Result of the Mailchimp operation.
	 * @param String $preferred_error Preset error to use instead of Mailchimp errors.
	 * @throws Exception Error message.
	 * @return The results of the API call.
	 */
	public function validate( $result, $preferred_error = null ) {
		if ( ! $result ) {
			if ( $preferred_error ) {
				throw new Exception( esc_html( $preferred_error ) );
			} else {
				throw new Exception( esc_html__( 'A Mailchimp error has occurred.', 'newspack-newsletters' ) );
			}
		}
		if ( ! empty( $result['status'] ) && in_array( $result['status'], [ 400, 404 ] ) ) {
			if ( $preferred_error && ! Newspack_Newsletters::debug_mode() ) {
				if ( ! empty( $result['detail'] ) ) {
					$preferred_error .= ' ' . $result['detail'];
				}
				throw new Exception( esc_html( $preferred_error ) );
			}
			$messages = [];
			if ( ! empty( $result['errors'] ) ) {
				foreach ( $result['errors'] as $error ) {
					if ( ! empty( $error['message'] ) ) {
						$messages[] = $error['message'];
					}
				}
			}
			if ( ! count( $messages ) && ! empty( $result['detail'] ) ) {
				$messages[] = $result['detail'];
			}
			if ( ! count( $messages ) ) {
				$message[] = __( 'A Mailchimp error has occurred.', 'newspack-newsletters' );
			}
			throw new Exception( esc_html( implode( ' ', $messages ) ) );
		}
		return $result;
	}

	/**
	 * Special handling for link hrefs containing Mailchimp merge fields.
	 *
	 * @param String $processed The processed link, with utm_medium parameter added.
	 * @param String $original The original, unprocessed link.
	 * @return The link to use.
	 */
	public function process_link( $processed, $original ) {
		// Match Mailchimp Merge Fields.
		if ( preg_match( '/\*\|([A-Z_0-9:]+)\|\*/', $original ) ) {
			// Check if http:// was prepended.
			if ( 0 === strpos( $original, 'http://*|' ) ) {
				$original = substr( $original, 7 );
			}
			return $original;
		}
		return $processed;
	}

	/**
	 * Add contact to a list with multiple groups and/or tags.
	 *
	 * @param array $contact The contact, as for the add_contact method.
	 * @param array $lists List IDs to add the contact to.
	 */
	public function add_contact_with_groups_and_tags( $contact, $lists ) {
		$results = [];
		$by_list = [];
		foreach ( $lists as $list_id ) {
			$group_or_tag_list = $this->maybe_extract_group_or_tag_list( $list_id );
			if ( $group_or_tag_list && isset( $group_or_tag_list['type'] ) ) {
				$list_id = $group_or_tag_list['list_id'];
				if ( 'group' === $group_or_tag_list['type'] && ! isset( $contact['interests'] ) ) {
					$contact['interests'] = [];
				}
				if ( isset( $by_list[ $list_id ] ) ) {
					$by_list[ $list_id ][] = $group_or_tag_list;
				} else {
					$by_list[ $list_id ] = [ $group_or_tag_list ];
				}
			} else {
				// It might be a local list – the list id has to be extracted from the DB.
				$local_list = Subscription_List::from_form_id( $list_id );
				if ( $local_list && $local_list->is_configured_for_provider( $this->service ) ) {
					$list_settings = $local_list->get_provider_settings( $this->service );
					if ( $list_settings !== null ) {
						$list_id = $list_settings['list'];
						$sublist = [
							'id'      => $list_settings['tag_id'],
							'list_id' => $list_id,
							'type'    => 'tag',
						];
						if ( isset( $by_list[ $list_id ] ) ) {
							$by_list[ $list_id ][] = $sublist;
						} else {
							$by_list[ $list_id ] = [ $sublist ];
						}
					}
				}
			}
			if ( ! isset( $by_list[ $list_id ] ) ) {
				// If this is not a group-or-tag list, nor a local list, treat the list ID as a regular list.
				$by_list[ $list_id ] = [];
			}
		}
		if ( empty( $by_list ) ) {
			return new WP_Error( 'No lists found.' );
		}

		foreach ( $by_list as $list_id => $sublists ) {
			$result = $this->add_contact( $contact, $list_id, $sublists );
			if ( is_wp_error( $result ) ) {
				return $result;
			}

			$results[] = $result;
		}
		return $results;
	}

	/**
	 * Add contact to a list.
	 *
	 * @param array  $contact      {
	 *    Contact data.
	 *
	 *    @type string   $email    Contact email address.
	 *    @type string   $name     Contact name. Optional.
	 *    @type string[] $metadata Contact additional metadata. Optional.
	 * }
	 * @param string $list_id      List to add the contact to.
	 * @param string $sublists     An array of groups and/or tags in the list to add the contact to.
	 *
	 * @return array|WP_Error Contact data if it was added, or error otherwise.
	 */
	public function add_contact( $contact, $list_id = false, $sublists = [] ) {
		if ( false === $list_id ) {
			return new WP_Error( 'newspack_newsletters_mailchimp_list_id', __( 'Missing list id.' ) );
		}
		$email_address = $contact['email'];

		// If contact was added in this execution, we can return the previous
		// result and bail.
		$cache_key = $list_id . $email_address . wp_json_encode( $sublists );
		if ( ! empty( self::$contacts_added[ $cache_key ] ) ) {
			return self::$contacts_added[ $cache_key ];
		}

		$new_contact_status = 'subscribed';
		if ( isset( $contact['metadata'] ) && ! empty( $contact['metadata']['status'] ) ) {
			$new_contact_status = $contact['metadata']['status'];
			unset( $contact['metadata']['status'] );
		}
		try {
			$mc             = new Mailchimp( $this->api_key() );
			$update_payload = [ 'email_address' => $email_address ];

			if ( isset( $contact['metadata'] ) && is_array( $contact['metadata'] ) && ! empty( $contact['metadata'] ) ) {
				$update_payload['merge_fields'] = [];

				$merge_fields_res = $mc->get( "lists/$list_id/merge-fields", [ 'count' => 1000 ] );
				if ( ! isset( $merge_fields_res['merge_fields'] ) ) {
					return new \WP_Error(
						'newspack_newsletters_mailchimp_add_contact_failed',
						sprintf(
							// Translators: %1$s is the error message.
							__( 'Error getting merge fields: %1$s', 'newspack-newsletters' ),
							$merge_fields_res['detail'] ?? __( 'Unable to fetch merge fields.' )
						)
					);
				}
				$existing_merge_fields = $merge_fields_res['merge_fields'];
				usort(
					$existing_merge_fields,
					function ( $a, $b ) {
						return $a['merge_id'] - $b['merge_id'];
					}
				);

				$list_merge_fields = [];

				// Handle duplicate fields.
				foreach ( $existing_merge_fields as $key => $field ) {
					if ( ! isset( $list_merge_fields[ $field['name'] ] ) ) {
						$list_merge_fields[ $field['name'] ] = $field['tag'];
					} else {
						Newspack_Newsletters_Logger::log(
							sprintf(
								// Translators: %1$s is the merge field name, %2$s is the unique tag.
								__( 'Warning: Duplicate merge field %1$s found with tag %2$s.', 'newspack-newsletters' ),
								$field['name'],
								$field['tag']
							)
						);
					}
				}

				foreach ( $contact['metadata'] as $key => $value ) {
					if ( isset( $list_merge_fields[ $key ] ) ) {
						$update_payload['merge_fields'][ $list_merge_fields[ $key ] ] = (string) $value;
					} else {
						$created_merge_field = $mc->post(
							"lists/$list_id/merge-fields",
							[
								'name' => $key,
								'type' => 'text',
							]
						);
						if ( isset( $created_merge_field['status'] ) && '4' === substr( $created_merge_field['status'], 0, 1 ) ) {
							Newspack_Newsletters_Logger::log(
								sprintf(
									// Translators: %1$s is the merge field key, %2$s is the error message.
									__( 'Failed to create merge field %1$s. Reason: %2$s', 'newspack-newsletters' ),
									$key,
									$created_merge_field['detail'] ?? $created_merge_field['title']
								)
							);
							continue;
						}
						$update_payload['merge_fields'][ $created_merge_field['tag'] ] = (string) $value;
					}
				}
			}

			$all_tags = [];
			// If the sublists contain any tags, fetch all tags.
			// This is needed because MC API expects tag names in the contact update payload, not ids.
			if ( array_filter(
				$sublists,
				function( $sublist ) {
					return 'tag' === $sublist['type']; }
			) ) {
				$all_tags = array_reduce(
					$mc->get( "lists/$list_id/tag-search" )['tags'],
					function( $tags, $tag ) {
						$tags[ $tag['id'] ] = $tag['name'];
						return $tags;
					},
					[]
				);
			}

			// Add groups and tags, if any.
			foreach ( $sublists as $sublist ) {
				$sublist_id   = $sublist['id'];
				$sublist_type = $sublist['type'];
				if ( 'group' === $sublist_type ) {
					if ( ! isset( $update_payload['interests'] ) ) {
						$update_payload['interests'] = [];
					}
					$update_payload['interests'][ $sublist['id'] ] = true;
				} elseif ( 'tag' === $sublist_type ) {
					if ( ! isset( $update_payload['tags'] ) ) {
						$update_payload['tags'] = [];
					}
					if ( isset( $all_tags[ $sublist_id ] ) ) {
						$update_payload['tags'][] = $all_tags[ $sublist_id ];
					}
				}
			}

			// If we're subscribing the contact to a newsletter, they should have some status
			// because 'non-subscriber' status can't receive newsletters.
			if ( ! empty( $list_id ) || ! empty( $sublists ) ) {
				$update_payload['status_if_new'] = $new_contact_status ?? 'subscribed';
				$update_payload['status']        = $new_contact_status ?? 'subscribed';
			}

			// Create or update a list member.
			$existing_contact = self::get_contact_data( $email_address );
			if ( is_wp_error( $existing_contact ) ) {
				$update_payload['status'] = $new_contact_status ?? 'subscribed';
				$result                   = $mc->post( "lists/$list_id/members", $update_payload );
			} else {
				$member_id = $existing_contact['id'];
				$result    = $mc->put( "lists/$list_id/members/$member_id", $update_payload );
			}
			if (
				! $result ||
				! isset( $result['status'] ) ||
				// See Mailchimp error code glossary: https://mailchimp.com/developer/marketing/docs/errors/#error-glossary.
				(int) $result['status'] >= 400 ||
				( isset( $result['errors'] ) && count( $result['errors'] ) )
			) {
				return new WP_Error(
					'newspack_newsletters_mailchimp_add_contact_failed',
					sprintf(
						/* translators: %s: Mailchimp error message */
						__( 'Failed to add contact to list. %s', 'newspack-newsletters' ),
						isset( $result['detail'] ) ? $result['detail'] : ''
					)
				);
			}
		} catch ( \Exception $e ) {
			return new \WP_Error(
				'newspack_newsletters_mailchimp_add_contact_failed',
				$e->getMessage()
			);
		}
		self::$contacts_added[ $cache_key ] = $result;
		return $result;
	}

	/**
	 * Delete contact from all lists given its email.
	 *
	 * @param string $email Email address.
	 *
	 * @return bool|WP_Error True if the contact was deleted, error if failed.
	 */
	public function delete_contact( $email ) {
		$contact = $this->get_contact_data( $email );
		if ( is_wp_error( $contact ) ) {
			return $contact;
		}
		foreach ( $contact['lists'] as $list_id => $list ) {
			try {
				$member_id = $list['id'];
				$mc        = new Mailchimp( $this->api_key() );
				$mc->delete( "lists/$list_id/members/$member_id" );
			} catch ( \Exception $e ) {
				return new \WP_Error(
					'newspack_newsletters_mailchimp_delete_contact_failed',
					$e->getMessage()
				);
			}
		}
		return true;
	}

	/**
	 * Get the lists a contact is subscribed to.
	 *
	 * @param string $email The contact email.
	 *
	 * @return string[] Contact subscribed lists IDs.
	 */
	public function get_contact_lists( $email ) {
		$contact = $this->get_contact_data( $email );
		if ( is_wp_error( $contact ) ) {
			return [];
		}
		$audience_lists = array_keys(
			array_filter(
				$contact['lists'],
				function ( $list ) {
					return 'subscribed' === $list['status'];
				}
			)
		);
		$groups_lists   = [];
		foreach ( $contact['interests'] as $list_id => $interests ) {
			foreach ( $interests as $group_id => $active ) {
				if ( $active ) {
					$groups_lists[] = $this->create_group_or_tag_list_id( $group_id, $list_id );
				}
			}
		}
		$tags_lists = [];
		foreach ( $contact['tags'] as $list_id => $tags ) {
			foreach ( $tags as $tag ) {
				$tags_lists[] = $this->create_group_or_tag_list_id( $tag['id'], $list_id, 'tag' );
			}
		}
		return array_merge( $audience_lists, $groups_lists, $tags_lists );
	}

	/**
	 * Update a contact lists subscription.
	 *
	 * @param string   $email           Contact email address.
	 * @param string[] $lists_to_add    Array of list IDs to subscribe the contact to.
	 * @param string[] $lists_to_remove Array of list IDs to remove the contact from.
	 *
	 * @return true|WP_Error True if the contact was updated or error.
	 */
	public function update_contact_lists( $email, $lists_to_add = [], $lists_to_remove = [] ) {
		$contact = $this->get_contact_data( $email );
		if ( is_wp_error( $contact ) ) {
			/** Create contact */
			$result = Newspack_Newsletters_Subscription::add_contact( [ 'email' => $email ], $lists_to_add );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
			return true;
		}
		$mc = new Mailchimp( $this->api_key() );
		try {
			foreach ( $lists_to_remove as $list_id ) {
				$list = $this->maybe_extract_group_or_tag_list( $list_id );
				if ( $list ) {
					$this->remove_group_or_tag_from_contact( $email, $list['id'], $list['list_id'], $list['type'] );
					continue;
				}
				if ( ! isset( $contact['lists'][ $list_id ] ) ) {
					continue;
				}
				$mc->patch( "lists/$list_id/members/" . $contact['lists'][ $list_id ]['contact_id'], [ 'status' => 'unsubscribed' ] );
			}
			if ( ! empty( $lists_to_add ) ) {
				$this->add_contact_with_groups_and_tags( [ 'email' => $email ], $lists_to_add );
			}
		} catch ( \Exception $e ) {
			return new \WP_Error(
				'newspack_newsletters_mailchimp_update_contact_failed',
				$e->getMessage()
			);
		}
		return true;
	}

	/**
	 * Get contact data by email.
	 *
	 * @param string $email          Email address.
	 * @param bool   $return_details Fetch full contact data.
	 *
	 * @return array|WP_Error Response or error if contact was not found.
	 */
	public function get_contact_data( $email, $return_details = false ) {
		$mc    = new Mailchimp( $this->api_key() );
		$found = $mc->get(
			'search-members',
			[
				'query' => $email,
			]
		)['exact_matches']['members'];
		if ( empty( $found ) ) {
			return new WP_Error( 'newspack_newsletters_mailchimp_contact_not_found', __( 'Contact not found', 'newspack-newsletters' ) );
		}

		$keys = [ 'full_name', 'email_address', 'id' ];
		$data = [
			'lists'     => [],
			'tags'      => [],
			'interests' => [],
		];
		foreach ( $found as $contact ) {
			foreach ( $keys as $key ) {
				if ( ! isset( $data[ $key ] ) || empty( $data[ $key ] ) ) {
					$data[ $key ] = $contact[ $key ];
				}
			}
			if ( isset( $contact['tags'] ) ) {
				$data['tags'][ $contact['list_id'] ] = $contact['tags'];
			}
			if ( isset( $contact['interests'] ) ) {
				$data['interests'][ $contact['list_id'] ] = $contact['interests'];
			}
			$data['lists'][ $contact['list_id'] ] = [
				'id'         => $contact['id'], // md5 hash of email.
				'contact_id' => $contact['contact_id'],
				'status'     => $contact['status'],
			];
		}
		return $data;
	}

	/**
	 * Get the IDs of the tags associated with a contact.
	 *
	 * @param string $email The contact email.
	 * @return array|WP_Error The tag IDs on success, grouped by lists. WP_Error on failure.
	 */
	public function get_contact_tags_ids( $email ) {
		$contact_data = $this->get_contact_data( $email );
		if ( is_wp_error( $contact_data ) ) {
			return $contact_data;
		}

		$contact_tags = [];

		foreach ( $contact_data['tags'] as $list_id => $tags ) {
			$contact_tags[ $list_id ] = array_map(
				function ( $tag ) {
					return (int) $tag['id'];
				},
				$tags
			);
		}

		return $contact_tags;
	}

	/**
	 * Get the contact local lists IDs
	 *
	 * Mailchimp has to override this method because we need to handle groups under many lists.
	 *
	 * In other providers, get_contact_esp_local_lists_ids returns a simple array with IDs, but in Mailchimp it returns IDs grouped by lists.
	 *
	 * @param string $email The contact email.
	 * @return string[] Array of local lists IDs or error.
	 */
	public function get_contact_local_lists( $email ) {
		$tags = $this->get_contact_esp_local_lists_ids( $email );
		if ( is_wp_error( $tags ) ) {
			return [];
		}
		$lists = Subscription_Lists::get_configured_for_provider( $this->service );
		$ids   = [];
		foreach ( $lists as $list ) {
			if ( ! $list->is_local() ) {
				continue;
			}
			$list_settings = $list->get_provider_settings( $this->service );

			if ( ! empty( $tags[ $list_settings['list'] ] ) ) {
				if ( in_array( $list_settings['tag_id'], $tags[ $list_settings['list'] ], false ) ) { // phpcs:ignore WordPress.PHP.StrictInArray.FoundNonStrictFalse
					$ids[] = $list->get_form_id();
				}
			}
		}
		return $ids;
	}

	/**
	 * Get the provider specific labels
	 *
	 * This allows us to make reference to provider specific features in the way the user is used to see them in the provider's UI
	 *
	 * @param string $context The context in which the labels are being applied.
	 * @return array
	 */
	public static function get_labels( $context = '' ) {
		$labels = [
			'name'                    => 'Mailchimp', // The provider name.
			'list'                    => __( 'audience', 'newspack-newsletters' ), // "list" in lower case singular format.
			'lists'                   => __( 'audiences', 'newspack-newsletters' ), // "list" in lower case plural format.
			'sublist'                 => __( 'group, segment, or tag', 'newspack-newsletters' ), // Sublist entities in lowercase singular format.
			'List'                    => __( 'Audience', 'newspack-newsletters' ), // "list" in uppercase case singular format.
			'Lists'                   => __( 'Audiences', 'newspack-newsletters' ), // "list" in uppercase case plural format.
			'Sublist'                 => __( 'Group, Segment, or Tag', 'newspack-newsletters' ), // Sublist entities in uppercase singular format.
			'list_explanation'        => __( 'Mailchimp Audience', 'newspack-newsletters' ),
			// translators: %s is the name of the group category. "Newspack newsletters" by default.
			'local_list_explanation'  => sprintf( __( 'Mailchimp Group under the %s category', 'newspack-newsletters' ), self::get_group_category_name() ),
			'tag_prefix'              => '',
			'tag_metabox_before_save' => __( 'Once this list is saved, a Group will be created for it.', 'newspack-newsletters' ),
			// translators: %s is the name of the group category. "Newspack newsletters" by default.
			'tag_metabox_after_save'  => sprintf( __( 'Group created for this list under %s:', 'newspack-newsletters' ), self::get_group_category_name() ),
		];
		if ( ! empty( $context ) && strpos( $context, 'group-' ) === 0 ) {
			$labels['list_explanation'] = __( 'Mailchimp Group', 'newspack-newsletters' );
		}
		if ( ! empty( $context ) && strpos( $context, 'tag-' ) === 0 ) {
			$labels['list_explanation'] = __( 'Mailchimp Tag', 'newspack-newsletters' );
		}
		return $labels;
	}

	/**
	 * Add a notice to the Subscription Lists metabox letting the user know that readers are also subscribed to the parent Audience
	 *
	 * @param array $settings The List settings.
	 * @return void
	 */
	public function lists_metabox_notice( $settings ) {
		if ( $settings['tag_name'] ) {
			?>
			<p class="subscription-list-warning">
				<?php
				esc_html_e( 'Note for Mailchimp: The group is a subset of the Audience selected above. When a reader subscribes to this List, they will also be subscribed to the selected Audience.', 'newspack-newsletters' );
				?>
			</p>
			<?php
		}
	}

	/**
	 * Replace some of the error messages sent by Mailchimp servers with a message that makes more sense to the user in the context of the plugin
	 *
	 * @param string $message The error message retrieved by the API.
	 * @return string The new error message if we have an option for it. The same message otherwise.
	 */
	public function get_better_error_message( $message ) {
		$known_errors = [
			'Error sending test email. This campaign cannot be tested:" A From Name must be entered on the Setup step."' => __( 'Error sending test email. Please enter a name and email in the "FROM" section.', 'newspack-newsletters' ),
		];
		return isset( $known_errors[ $message ] ) ? $known_errors[ $message ] : $message;
	}

	/**
	 * Creates a list ID based on the type, the ID and the list ID
	 *
	 * In Mailchimp, we offer both Audiences, Groups, and Tags as Subscription Lists. We modify the group and tag IDs so we can differentiate them from the Audiences IDs.
	 *
	 * Also, when working with groups or tags, we need to know the list ID, so we add it to the ID.
	 *
	 * @param string $item_id The item ID.
	 * @param string $list_id The List/Audience ID.
	 * @param string $type 'group' or 'tag'.
	 * @return string
	 */
	public function create_group_or_tag_list_id( $item_id, $list_id, $type = 'group' ) {
		return $type . '-' . $item_id . '-' . $list_id;
	}

	/**
	 * Extract the group or tag + audience (list) ID from an ID created with create_group_or_tag_list_id
	 *
	 * @param string $list_id The list ID.
	 * @return array|false Array with the group/tag ID and the list ID or false if the ID is not a group or tag list ID.
	 */
	public function maybe_extract_group_or_tag_list( $list_id ) {
		$pattern = '/^(group|tag)-([^-]+)-([^-]+)$/';
		if ( preg_match( $pattern, $list_id, $matches ) ) {
			$extracted_ids = [
				'id'      => $matches[2],
				'list_id' => $matches[3],
				'type'    => $matches[1],
			];

			return $extracted_ids;
		}
		return false;
	}

	/**
	 * Get usage report.
	 */
	public function get_usage_report() {
		return Newspack_Newsletters_Mailchimp_Usage_Reports::get_usage_report();
	}
}

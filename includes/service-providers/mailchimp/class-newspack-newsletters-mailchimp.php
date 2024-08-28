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
				$mc->get( "campaigns/$mc_campaign_id" ),
				__( 'Error retrieving Mailchimp campaign.', 'newspack_newsletters' )
			);
			$list_id = $campaign && isset( $campaign['recipients']['list_id'] ) ? $campaign['recipients']['list_id'] : null;

			$lists = $this->get_lists( true );
			if ( \is_wp_error( $lists ) ) {
				return $lists;
			}

			$newsletter_data = [
				'campaign'            => $campaign,
				'campaign_id'         => $mc_campaign_id,
				'folders'             => Newspack_Newsletters_Mailchimp_Cached_Data::get_folders(),
				'interest_categories' => $this->get_interest_categories( $list_id ),
				'lists'               => $lists,
				'merge_fields'        => $list_id ? Newspack_Newsletters_Mailchimp_Cached_Data::get_merge_fields( $list_id ) : [],
				'segments'            => $list_id ? Newspack_Newsletters_Mailchimp_Cached_Data::get_segments( $list_id ) : [],
				'tags'                => $this->get_tags( $list_id ),
			];

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
		try {
			$mc             = new Mailchimp( $this->api_key() );
			$lists_response = $this->validate(
				$mc->get(
					'lists',
					[
						'count' => 1000,
					]
				),
				__( 'Error retrieving Mailchimp lists.', 'newspack_newsletters' )
			);
			if ( is_wp_error( $lists_response ) ) {
				return new WP_Error(
					'newspack_newsletters_mailchimp_error',
					$lists_response->getMessage()
				);
			}

			if ( ! isset( $lists_response['lists'] ) ) {
				$error_message  = __( 'Error retrieving Mailchimp lists.', 'newspack_newsletters' );
				$error_message .= ! empty( $lists_response['title'] ) ? ' ' . $lists_response['title'] : '';
				return new WP_Error(
					'newspack_newsletters_mailchimp_error',
					$error_message
				);
			}

			if ( $audiences_only ) {
				return $lists_response['lists'];
			}

			$lists = [];

			// In addition to Audiences, we also automatically fetch all groups and tags and offer them as Subscription Lists.
			// Build the final list inside the loop so groups are added after the list they belong to and we can then represent the hierarchy in the UI.
			foreach ( $lists_response['lists'] as $list ) {

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
							$group['id']   = Subscription_List::mailchimp_generate_public_id( $group['id'], $list['id'] );
							$group['type'] = 'mailchimp-group';
							return $group;
						},
						$all_groups['interests'] ?? [] // Yes, two levels of 'interests'.
					);
					$lists  = array_merge( $lists, $groups );
				}

				foreach ( $all_tags as $tag ) {
					$tag['id']   = Subscription_List::mailchimp_generate_public_id( $tag['id'], $list['id'], 'tag' );
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
		} catch ( Exception $e ) {
			return new WP_Error(
				'newspack_newsletters_mailchimp_error',
				$e->getMessage()
			);
		}
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
						$local_id = Subscription_List::mailchimp_generate_public_id( $interest['id'], $list_id );
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
				$local_id = Subscription_List::mailchimp_generate_public_id( $tag['id'], $list_id, 'tag' );
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
		// Clear prior error messages.
		$transient_name = $this->get_transient_name( $post->ID );
		delete_transient( $transient_name );
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
			set_transient( $transient_name, __( 'Error syncing with ESP. ', 'newspack-newsletters' ) . $e->getMessage(), 45 );
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
	 * Upserts a contact to the ESP using the provider specific methods.
	 *
	 * Here we group all groups and tags by Audience, so we can add many lists at once.
	 *
	 * @param array               $contact The contact, as for the add_contact method.
	 * @param Subscription_List[] $lists The lists.
	 * @return array|WP_Error Contact data if it was added, or error otherwise.
	 */
	public function upsert_contact( $contact, $lists ) {

		$prepared_lists = $this->prepare_lists_to_add_contact( $lists );

		if ( empty( $prepared_lists ) ) {
			return new WP_Error( 'No lists found.' );
		}

		foreach ( $prepared_lists as $audience_id => $sublists ) {
			$result = $this->add_contact( $contact, $audience_id, $sublists['tags'], $sublists['interests'] );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}

		// on success, return the last resutl.
		return $result;
	}

	/**
	 * Loops through a list of Subscription_Lists objects and group them to be sent to the `add_contact` method with tags and interests attached.
	 *
	 * @param Subscription_List[] $lists The lists.
	 * @return array The lists array where the keys are the Audience IDs and the values are an array with 'tags' and 'interests' keys.
	 */
	private function prepare_lists_to_add_contact( $lists ) {

		$result = [];

		foreach ( $lists as $list ) {

			$audience_id = $list->mailchimp_get_audience_id();

			if ( ! isset( $result[ $audience_id ] ) ) {
				$result[ $audience_id ] = [
					'tags'      => [],
					'interests' => [],
				];
			}

			if ( 'tag' === $list->mailchimp_get_sublist_type() ) {
				// Mailchimp API expects the tag name and not ID.
				$result[ $audience_id ]['tags'][] = $list->get_remote_name();
			} elseif ( 'group' === $list->mailchimp_get_sublist_type() ) {
				// Local lists are included here.
				$result[ $audience_id ]['interests'][ $list->mailchimp_get_sublist_id() ] = true;
			}
		}

		return $result;
	}

	/**
	 * Get merge field type.
	 *
	 * @param mixed $value Value to check.
	 *
	 * @return string Merge field type.
	 */
	private function get_merge_field_type( $value ) {
		if ( is_numeric( $value ) ) {
			return 'number';
		}
		if ( is_bool( $value ) ) {
			return 'boolean';
		}
		return 'text';
	}

	/**
	 * Given a contact metadata array, build the `merge_fields` array to be sent to Mailchimp
	 * by sarching for existing merge fields and creating new ones as needed.
	 *
	 * @param string $audience_id Audience ID.
	 * @param array  $data        The contact metadata.
	 *
	 * @return array Merge fields.
	 */
	private function prepare_merge_fields( $audience_id, $data ) {
		$merge_fields = [];

		// Strip arrays and statuses.
		$data = array_filter(
			$data,
			function( $value, $key ) {
				return ! is_array( $value ) && 'status' !== $key && 'status_if_new' !== $key;
			},
			ARRAY_FILTER_USE_BOTH
		);

		// Get and match existing merge fields.
		try {
			$existing_fields = Newspack_Newsletters_Mailchimp_Cached_Data::get_merge_fields( $audience_id );
		} catch ( \Exception $e ) {
			Newspack_Newsletters_Logger::log(
				sprintf(
					// Translators: %1$s is the error message.
					__( 'Error getting merge fields: %1$s', 'newspack-newsletters' ),
					$existing_fields->get_error_message()
				)
			);
			return [];
		}
		if ( empty( $existing_fields ) ) {
			$existing_fields = [];
		}

		usort(
			$existing_fields,
			function( $a, $b ) {
				return $a['merge_id'] - $b['merge_id'];
			}
		);

		$list_merge_fields = [];

		// Handle duplicate fields.
		foreach ( $existing_fields as $field ) {
			if ( ! isset( $list_merge_fields[ $field['name'] ] ) ) {
				$list_merge_fields[ $field['name'] ] = $field['tag'];
			} else {
				Newspack_Newsletters_Logger::log(
					sprintf(
						// Translators: %1$s is the merge field name, %2$s is the field's unique tag.
						__( 'Warning: Duplicate merge field %1$s found with tag %2$s.', 'newspack-newsletters' ),
						$field['name'],
						$field['tag']
					)
				);
			}
		}

		foreach ( $data as $field_name => $field_value ) {
			// If field already exists, add it to the payload.
			if ( isset( $list_merge_fields[ $field_name ] ) ) {
				$merge_fields[ $list_merge_fields[ $field_name ] ] = $data[ $field_name ];
				unset( $data[ $field_name ] );
			}
		}

		// Create remaining fields.
		$remaining_fields = array_keys( $data );
		$mc             = new Mailchimp( $this->api_key() );
		foreach ( $remaining_fields as $field_name ) {
			$created_field = $mc->post(
				"lists/$audience_id/merge-fields",
				[
					'name' => $field_name,
					'type' => $this->get_merge_field_type( $data[ $field_name ] ),
				]
			);
			// Skip field if it failed to create.
			if ( empty( $created_field['merge_id'] ) ) {
				Newspack_Newsletters_Logger::log(
					sprintf(
					// Translators: %1$s is the merge field key, %2$s is the error message.
						__( 'Failed to create merge field %1$s. Error response: %2$s', 'newspack-newsletters' ),
						$field_name,
						$created_field['detail'] ?? 'Unknown error'
					)
				);
				continue;
			}
			Newspack_Newsletters_Logger::log(
				sprintf(
					// Translators: %1$s is the merge field key, %2$s is the error message.
					__( 'Created merge field %1$s.', 'newspack-newsletters' ),
					$field_name
				)
			);
			$merge_fields[ $created_field['tag'] ] = $data[ $field_name ];
		}

		return $merge_fields;
	}

	/**
	 * Gets the status and/or status_if_new keys based on the contact data.
	 *
	 * @param array $contact      {
	 *   Contact data.
	 *
	 *    @type string   $email    Contact email address.
	 *    @type string   $name     Contact name. Optional.
	 *    @type string[] $metadata Contact additional metadata. Optional.
	 * }
	 *
	 * @return array The status and/or status_if_new keys to be added to the payload
	 */
	private function get_status_for_payload( $contact ) {
		$return = [];
		if ( isset( $contact['metadata'] ) && ! empty( $contact['metadata']['status_if_new'] ) ) {
			$return['status_if_new'] = $contact['metadata']['status_if_new'];
		}

		if ( isset( $contact['metadata'] ) && ! empty( $contact['metadata']['status'] ) ) {
			$return['status'] = $contact['metadata']['status'];
		}

		// If we're subscribing the contact to a newsletter, they should have some status
		// because 'non-subscriber' status can't receive newsletters.
		if ( empty( $return['status'] ) && empty( $return['status_if_new'] ) ) {
			$return['status'] = 'subscribed';
		}
		return $return;
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
	 * @param string $list_id   List (Audience) to add the contact to.
	 * @param array  $tags      An array of tag names to be added to the contact. Tags are always appended.
	 * @param array  $interests An array of interests as expected by the API, where the key is the interest ID and the value is a bool (add or remove).
	 *
	 * @return array|WP_Error Contact data if it was added, or error otherwise.
	 */
	public function add_contact( $contact, $list_id = false, $tags = [], $interests = [] ) {
		if ( false === $list_id ) {
			return new WP_Error( 'newspack_newsletters_mailchimp_list_id', __( 'Missing list id.' ) );
		}
		$email_address = $contact['email'];

		// If contact was added in this execution, we can return the previous
		// result and bail.
		$cache_key = md5( $list_id . $email_address . wp_json_encode( $tags ) . wp_json_encode( $interests ) );
		if ( ! empty( self::$contacts_added[ $cache_key ] ) ) {
			return self::$contacts_added[ $cache_key ];
		}

		$update_payload = [ 'email_address' => $email_address ];

		$update_payload = array_merge(
			$update_payload,
			$this->get_status_for_payload( $contact )
		);

		try {

			$mc = new Mailchimp( $this->api_key() );

			if ( isset( $contact['metadata'] ) && is_array( $contact['metadata'] ) && ! empty( $contact['metadata'] ) ) {
				$merge_fields = $this->prepare_merge_fields( $list_id, $contact['metadata'] );
				if ( ! empty( $merge_fields ) ) {
					$update_payload['merge_fields'] = $merge_fields;
				}
			}

			// Add groups and tags, if any.
			if ( ! empty( $tags ) ) {
				$update_payload['tags'] = $tags;
			}
			if ( ! empty( $interests ) ) {
				$update_payload['interests'] = $interests;
			}

			Newspack_Newsletters_Logger::log( 'Mailchimp add_contact PUT payload: ' . wp_json_encode( $update_payload ) );

			// Create or update a list member.
			$member_hash = Mailchimp::subscriberHash( $email_address );
			$result = $mc->put( "lists/$list_id/members/$member_hash", $update_payload );

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
					$groups_lists[] = Subscription_List::mailchimp_generate_public_id( $group_id, $list_id );
				}
			}
		}
		$tags_lists = [];
		foreach ( $contact['tags'] as $list_id => $tags ) {
			foreach ( $tags as $tag ) {
				$tags_lists[] = Subscription_List::mailchimp_generate_public_id( $tag['id'], $list_id, 'tag' );
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
			$result = Newspack_Newsletters_Contacts::upsert( [ 'email' => $email ], $lists_to_add );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
			return true;
		}
		$mc = new Mailchimp( $this->api_key() );
		try {
			// Remove lists.
			foreach ( $lists_to_remove as $list_id ) {
				$list_obj = Subscription_List::from_public_id( $list_id );
				if ( ! $list_obj ) {
					continue;
				}

				if ( 'group' === $list_obj->mailchimp_get_sublist_type() ) {
					$this->remove_group_from_contact( $email, $list_obj->mailchimp_get_sublist_id(), $list_obj->mailchimp_get_audience_id() );
				} elseif ( 'tag' === $list_obj->mailchimp_get_sublist_type() ) {
					$this->remove_tag_from_contact( $email, $list_obj->mailchimp_get_sublist_id(), $list_obj->mailchimp_get_audience_id() );
				}

				// If $list_id is an Audience the contact is a part of, unsubscribe them.
				if ( isset( $contact['lists'][ $list_id ] ) ) {
					$mc->patch( "lists/$list_id/members/" . $contact['lists'][ $list_id ]['contact_id'], [ 'status' => 'unsubscribed' ] );
				}
			}

			// Add lists.
			if ( ! empty( $lists_to_add ) ) {
				$lists_objects = [];
				foreach ( $lists_to_add as $list_id ) {
					$list_obj = Subscription_List::from_public_id( $list_id );
					if ( ! $list_obj ) {
						continue;
					}
					$lists_objects[] = $list_obj;
				}
				$this->upsert_contact( [ 'email' => $email ], $lists_objects );
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
		$result  = $mc->get(
			'search-members',
			[
				'query' => $email,
			]
		);

		if ( ! isset( $result['exact_matches']['members'] ) ) {
			return new WP_Error( 'newspack_newsletters_mailchimp_search_members', __( 'Error reaching to search-members endpoint', 'newspack-newsletters' ) );
		}

		$found = $result['exact_matches']['members'];
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
					$ids[] = $list->get_public_id();
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
			'List'                    => __( 'Audience', 'newspack-newsletters' ), // "list" in uppercase case singular format.
			'Lists'                   => __( 'Audiences', 'newspack-newsletters' ), // "list" in uppercase case plural format.
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
	 * Get usage report.
	 */
	public function get_usage_report() {
		return Newspack_Newsletters_Mailchimp_Usage_Reports::get_usage_report();
	}
}

<?php
/**
 * Newspack Newsletters Subscription List
 *
 * @package Newspack
 */

namespace Newspack\Newsletters;

use Newspack_Newsletters;
use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Class used to represent one Subscription List
 */
class Subscription_List {

	/**
	 * Hold the WP_Post object associated with this List.
	 *
	 * @var WP_Post
	 */
	protected $post;

	/**
	 * The meta key where the settings are stored.
	 */
	const META_KEY = 'newspack_nl_provider_settings';

	/**
	 * Initializes a new Subscription List
	 *
	 * @param WP_Post|int $post_or_id The post object or ID.
	 * @throws \InvalidArgumentException In case the post is not found.
	 */
	public function __construct( $post_or_id ) {
		if ( ! $post_or_id instanceof WP_Post ) {
			$post_or_id = get_post( (int) $post_or_id );
			if ( ! $post_or_id instanceof WP_Post ) {
				throw new \InvalidArgumentException( 'Post not found' );
			}
		}
		$this->post = $post_or_id;
	}

	/**
	 * Gets the List ID
	 *
	 * @return int
	 */
	public function get_id() {
		return $this->post->ID;
	}

	/**
	 * Gets the List title
	 *
	 * @return string
	 */
	public function get_title() {
		return $this->post->post_title;
	}

	/**
	 * Gets the List description
	 *
	 * @return string
	 */
	public function get_description() {
		return $this->post->post_content;
	}

	/**
	 * Returns the settings stored for a provider
	 *
	 * @param string $provider_slug The provider slug.
	 * @return ?array
	 */
	public function get_provider_settings( $provider_slug ) {
		$meta = $this->get_all_providers_settings();
		if ( ! empty( $provider_slug ) && is_array( $meta ) && ! empty( $meta[ $provider_slug ] ) ) {
			return $meta[ $provider_slug ];
		}
		return null;
	}

	/**
	 * Returns the settings stored for the current service provicer
	 *
	 * @return ?array
	 */
	public function get_current_provider_settings() {
		return $this->get_provider_settings( Newspack_Newsletters::service_provider() );
	}

	/**
	 * Gets all the settings stored for all providers
	 *
	 * @return array
	 */
	public function get_all_providers_settings() {
		$settings = get_post_meta( $this->get_id(), self::META_KEY, true );
		return is_array( $settings ) ? $settings : [];
	}

	/**
	 * Gets a list of all providers slugs this List has configuration for
	 *
	 * @return array
	 */
	public function get_configured_providers() {
		return array_keys( $this->get_all_providers_settings() );
	}

	/**
	 * Gets a list of all providers slugs this List has configuration for, excluding the current active provider
	 *
	 * @return array
	 */
	public function get_other_configured_providers() {
		$providers = array_keys( $this->get_all_providers_settings() );
		return array_values( array_diff( $providers, [ Newspack_Newsletters::service_provider() ] ) );
	}

	/**
	 * Gets a list of all providers names this List has configuration for
	 *
	 * @param boolean $ignore_current Whether to ignore the current provider or not.
	 * @return array
	 */
	public function get_configured_providers_names( $ignore_current = false ) {
		$providers = $ignore_current ? $this->get_other_configured_providers() : $this->get_configured_providers();
		$names     = [];
		foreach ( $providers as $provider_slug ) {
			$provider = Newspack_Newsletters::get_service_provider_instance( $provider_slug );
			if ( is_object( $provider ) ) {
				$names[] = $provider::label( 'name' );
			}
		}
		return $names;
	}

	/**
	 * Gets a list of all providers names this List has configuration for, excluding the current active provider
	 *
	 * @return array
	 */
	public function get_other_configured_providers_names() {
		return $this->get_configured_providers_names( true );
	}

	/**
	 * Checks if this List has any other providers configured other than the current active provider
	 *
	 * @return boolean
	 */
	public function has_other_configured_providers() {
		return ! empty( $this->get_other_configured_providers() );

	}

	/**
	 * Updates the settings of a provider
	 *
	 * @param string $list The list ID readers will be added to when they signup for this List.
	 * @param string $tag The Tag that will be added readers who signup to this List.
	 * @return int|bool Meta ID if the key didn't exist, true on successful update, false on failure or if the value passed to the function is the same as the one that is already in the database.
	 */
	public function update_current_provider_settings( $list, $tag ) {
		if ( empty( $list ) ) {
			return false;
		}
		$settings = $this->get_all_providers_settings();
		$settings[ Newspack_Newsletters::service_provider() ] = [
			'list' => $list,
			'tag'  => $tag,
		];
		return update_post_meta( $this->get_id(), self::META_KEY, $settings );
	}

}

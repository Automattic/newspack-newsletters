<?php
/**
 * Plugin Name:     Newspack Newsletters
 * Plugin URI:      https://newspack.blog
 * Description:     Newsletter authoring using the Gutenberg editor.
 * Author:          Automattic
 * Author URI:      https://newspack.blog
 * Text Domain:     newspack-newsletters
 * Domain Path:     /languages
 * Version:         1.0.0
 *
 * @package         Newspack_Newsletters
 */

defined( 'ABSPATH' ) || exit;

// Define NEWSPACK_NEWSLETTERS_PLUGIN_FILE.
if ( ! defined( 'NEWSPACK_NEWSLETTERS_PLUGIN_FILE' ) ) {
	define( 'NEWSPACK_NEWSLETTERS_PLUGIN_FILE', plugin_dir_path( __FILE__ ) );
}

// Include main plugin resources.
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/vendor/autoload.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/interface-newspack-newsletters-esp-service.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/interface-newspack-newsletters-wp-hookable.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/class-newspack-newsletters-service-provider.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/mailchimp/class-newspack-newsletters-mailchimp.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-editor.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-layouts.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-settings.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-renderer.php';

// Include the main Newspack Newsletters class.
if ( ! class_exists( 'Newspack_Newsletters' ) ) {
	include_once dirname( __FILE__ ) . '/includes/class-newspack-newsletters.php';
}

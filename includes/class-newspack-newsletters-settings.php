<?php
/**
 * Newspack Newsletters Settubgs Page
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Manages Settings page.
 */
class Settings {
	/**
	 * Set up hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', [ __CLASS__, 'add_plugin_page' ] );
		add_action( 'admin_init', [ __CLASS__, 'page_init' ] );
	}

	/**
	 * Add options page
	 */
	public static function add_plugin_page() {
		add_options_page(
			'Settings Admin',
			'Newspack Newsletters',
			'manage_options',
			'newspack-newsletters-settings-admin',
			[ __CLASS__, 'create_admin_page' ]
		);
	}

	/**
	 * Options page callback
	 */
	public static function create_admin_page() {
		$newspack_newsletters_mailchimp_api_key = get_option( 'newspack_newsletters_mailchimp_api_key' );
		?>
		<div class="wrap">
			<h1>Newspack Newsletters Settings</h1>
			<form method="post" action="options.php">
			<?php
				settings_fields( 'newspack_newsletters_options_group' );
				do_settings_sections( 'newspack-newsletters-settings-admin' );
				submit_button();
			?>
			</form>
		</div>
		<?php
	}

	/**
	 * Register and add settings
	 */
	public static function page_init() {
		register_setting(
			'newspack_newsletters_options_group',
			'newspack_newsletters_mailchimp_api_key'
		);
		add_settings_section(
			'newspack_newsletters_options_group',
			'Newspack Newsletters Custom Settings',
			null,
			'newspack-newsletters-settings-admin'
		);
		add_settings_field(
			'newspack_newsletters_mailchimp_api_key',
			__( 'Mailchimp API Key', 'newspack' ),
			[ __CLASS__, 'newspack_newsletters_mailchimp_api_key_callback' ],
			'newspack-newsletters-settings-admin',
			'newspack_newsletters_options_group'
		);
	}

	/**
	 * Render Mailchimp API  field.
	 */
	public static function newspack_newsletters_mailchimp_api_key_callback() {
		$newspack_newsletters_mailchimp_api_key = get_option( 'newspack_newsletters_mailchimp_api_key', false );
		printf(
			'<input type="text" id="newspack_newsletters_mailchimp_api_key" name="newspack_newsletters_mailchimp_api_key" value="%s" />',
			esc_attr( $newspack_newsletters_mailchimp_api_key )
		);
	}
}

if ( is_admin() ) {
	Settings::init();
}

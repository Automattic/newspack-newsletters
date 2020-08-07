<?php
/**
 * Newspack Newsletters Settings Page
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Manages Settings page.
 */
class Newspack_Newsletters_Settings {
	/**
	 * Set up hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', [ __CLASS__, 'add_plugin_page' ] );
		add_action( 'admin_init', [ __CLASS__, 'page_init' ] );
	}

	/**
	 * Retreives list of settings.
	 *
	 * @return array Settings list.
	 */
	public static function get_settings_list() {
		return array(
			array(
				'description' => __( 'Service Provider', 'newspack-newsletters' ),
				'key'         => 'newspack_newsletters_service_provider',
				'options'     => array(
					array(
						'name'  => __( 'Select service provider', 'newspack-newsletter' ),
						'value' => '',
					),
					array(
						'name'  => __( 'Mailchimp', 'newspack-newsletters' ),
						'value' => 'mailchimp',
					),
					array(
						'name'  => __( 'Constant Contact', 'newspack-newsletters' ),
						'value' => 'constant_contact',
					),
				),
				'type'        => 'select',
			),
			array(
				'description' => __( 'Mailchimp API Key', 'newspack-newsletters' ),
				'key'         => 'newspack_newsletters_mailchimp_api_key',
				'type'        => 'text',
			),
			array(
				'description' => __( 'Constant Contact API Key', 'newspack-newsletters' ),
				'key'         => 'newspack_newsletters_constant_contact_api_key',
				'type'        => 'text',
			),
			array(
				'description' => __( 'Constant Contact API Access token', 'newspack-newsletters' ),
				'key'         => 'newspack_newsletters_constant_contact_api_access_token',
				'type'        => 'text',
			),
			array(
				'description' => __( 'MJML Application ID', 'newspack-newsletters' ),
				'key'         => 'newspack_newsletters_mjml_api_key',
				'type'        => 'text',
			),
			array(
				'description' => __( 'MJML Secret Key', 'newspack-newsletters' ),
				'key'         => 'newspack_newsletters_mjml_api_secret',
				'type'        => 'text',
			),
		);
	}

	/**
	 * Add options page
	 */
	public static function add_plugin_page() {
		add_submenu_page(
			'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			__( 'Newsletters Settings', 'newspack-newsletters' ),
			__( 'Settings', 'newspack-newsletters' ),
			'manage_options',
			'newspack-newsletters-settings-admin',
			[ __CLASS__, 'create_admin_page' ]
		);
	}

	/**
	 * Options page callback
	 */
	public static function create_admin_page() {
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Newsletters Settings', 'newspack-newsletters' ); ?></h1>
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
		add_settings_section(
			'newspack_newsletters_options_group',
			null,
			null,
			'newspack-newsletters-settings-admin'
		);
		foreach ( self::get_settings_list() as $setting ) {
			register_setting(
				'newspack_newsletters_options_group',
				$setting['key']
			);
			add_settings_field(
				$setting['key'],
				$setting['description'],
				[ __CLASS__, 'newspack_newsletters_settings_callback' ],
				'newspack-newsletters-settings-admin',
				'newspack_newsletters_options_group',
				$setting
			);
		};
	}

	/**
	 * Render settings fields.
	 *
	 * @param string $setting Setting key.
	 */
	public static function newspack_newsletters_settings_callback( $setting ) {
		$key         = $setting['key'];
		$type        = $setting['type'];
		$description = $setting['description'];
		$value       = get_option( $key, false );

		if ( 'select' === $type ) {
			$options     = $setting['options'];
			$add_options = '';

			foreach ( $options as $option ) {
				$add_options .= '<option ' . ( $value === $option['value'] ? 'selected' : '' ) . ' value="' . esc_attr( $option['value'] ) . '">' . esc_html( $option['name'] ) . '</option>';
			}

			$allowed_html = array(
				'option' => array(
					'value'    => array(),
					'selected' => array(),
				),
			);

			printf(
				'<select id="%s" name="%s" value="%s">%s</select>',
				esc_attr( $key ),
				esc_attr( $key ),
				esc_attr( $value ),
				wp_kses( $add_options, $allowed_html )
			);
		} else {
			printf(
				'<input type="text" id="%s" name="%s" value="%s" class="widefat" />',
				esc_attr( $key ),
				esc_attr( $key ),
				esc_attr( $value )
			);
		}
	}
}

if ( is_admin() ) {
	Newspack_Newsletters_Settings::init();
}

<?php
/**
 * Newspack Newsletters Tracking Admin UI Tweaks.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Tracking;

/**
 * Tracking Admin Class.
 */
final class Admin {
	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', [ __CLASS__, 'add_settings_page' ] );
		add_action( 'admin_init', [ __CLASS__, 'register_settings' ] );
		add_action( 'manage_' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_posts_columns', [ __CLASS__, 'manage_columns' ] );
		add_action( 'manage_' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_posts_custom_column', [ __CLASS__, 'custom_column' ], 10, 2 );
		add_action( 'manage_edit-' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT . '_sortable_columns', [ __CLASS__, 'sortable_columns' ] );
		add_action( 'pre_get_posts', [ __CLASS__, 'handle_sorting' ] );
	}

	/**
	 * Add settings page submenu.
	 */
	public static function add_settings_page() {
		\add_submenu_page(
			'edit.php?post_type=' . \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			esc_html__( 'Newsletters Tracking Options', 'newspack-newsletters' ),
			esc_html__( 'Tracking', 'newspack-newsletters' ),
			'manage_options',
			'newspack-newsletters-tracking',
			[ __CLASS__, 'render_settings_page' ]
		);
	}

	/**
	 * Create settings page.
	 */
	public static function render_settings_page() {
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Newsletters Tracking Options', 'newspack-newsletters' ); ?></h1>
			<form method="post" action="options.php">
				<?php
				\settings_fields( 'newspack_newsletters_tracking' );
				\do_settings_sections( 'newspack-newsletters-tracking' );
				\submit_button();
				?>
			</form>
		</div>
		<?php
	}

	/**
	 * Register and add settings
	 */
	public static function register_settings() {
		\add_settings_section(
			'newspack_newsletters_tracking',
			null,
			null,
			'newspack-newsletters-tracking'
		);
		$config = [
			[
				'name'              => 'newspack_newsletter_use_tracking_pixel',
				'type'              => 'boolean',
				'description'       => __( 'Enable tracking pixel', 'newspack-newsletters' ),
				'sanitize_callback' => 'boolval',
				'default'           => true,
			],
			[
				'name'              => 'newspack_newsletter_use_click_tracking',
				'type'              => 'boolean',
				'description'       => __( 'Enable click-tracking', 'newspack-newsletters' ),
				'sanitize_callback' => 'boolval',
				'default'           => true,
			],
		];
		foreach ( $config as $setting ) {
			\register_setting(
				'newspack_newsletters_tracking',
				$setting['name'],
				[
					'type'              => $setting['type'],
					'description'       => $setting['description'],
					'sanitize_callback' => $setting['sanitize_callback'],
					'default'           => $setting['default'],
				]
			);
			\add_settings_field(
				$setting['name'],
				$setting['description'],
				[ __CLASS__, 'field_callback' ],
				'newspack-newsletters-tracking',
				'newspack_newsletters_tracking',
				$setting
			);
		}
	}

	/**
	 * Settings callback.
	 *
	 * @param array $setting Setting config.
	 */
	public static function field_callback( $setting ) {
		$type = $setting['type'] ?? '';
		switch ( $setting['type'] ) {
			case 'boolean':
				?>
				<input
					type="checkbox"
					name="<?php echo esc_attr( $setting['name'] ); ?>"
					value="1"
					<?php checked( 1, get_option( $setting['name'] ) ); ?>
				/>
				<?php
				break;
			case 'text':
			default:
				?>
				<input
					type="text"
					name="<?php echo esc_attr( $setting['name'] ); ?>"
					value="<?php echo esc_attr( get_option( $setting['name'] ) ); ?>"
				/>
				<?php
				break;
		}
	}

	/**
	 * Manage columns.
	 *
	 * @param array $columns Columns.
	 */
	public static function manage_columns( $columns ) {
		$columns['opened'] = __( 'Opened', 'newspack-newsletters' );
		$columns['clicks'] = __( 'Clicks', 'newspack-newsletters' );
		return $columns;
	}

	/**
	 * Custom column content.
	 *
	 * @param array $column_name Column name.
	 * @param int   $post_id     Post ID.
	 */
	public static function custom_column( $column_name, $post_id ) {
		if ( 'opened' === $column_name ) {
			echo intval( get_post_meta( $post_id, 'tracking_pixel_seen', true ) );
		} elseif ( 'clicks' === $column_name ) {
			echo intval( get_post_meta( $post_id, 'tracking_clicks', true ) );
		}
	}

	/**
	 * Sortable columns.
	 *
	 * @param array $columns Columns.
	 */
	public static function sortable_columns( $columns ) {
		$columns['opened'] = 'opened';
		$columns['clicks'] = 'clicks';
		return $columns;
	}

	/**
	 * Handle sorting.
	 *
	 * @param \WP_Query $query Query.
	 */
	public static function handle_sorting( $query ) {
		if ( ! is_admin() || ! $query->is_main_query() ) {
			return;
		}
		if ( \Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT !== $query->get( 'post_type' ) ) {
			return;
		}

		$orderby = $query->get( 'orderby' );
		if ( 'opened' === $orderby ) {
			$query->set( 'meta_key', 'tracking_pixel_seen' );
			$query->set( 'orderby', 'meta_value_num' );
		} elseif ( 'clicks' === $orderby ) {
			$query->set( 'meta_key', 'tracking_clicks' );
			$query->set( 'orderby', 'meta_value_num' );
		}
	}
}
Admin::init();

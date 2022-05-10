<?php
/**
 * Newspack Newsletter Blocks
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Main Newspack Newsletters Blocks Class.
 */
final class Newspack_Newsletters_Blocks {
	/**
	 * The single instance of the class.
	 *
	 * @var Newspack_Newsletters_Blocks
	 */
	protected static $instance = null;

	/**
	 * Main Newspack Newsletter Editor Instance.
	 * Ensures only one instance of Newspack Editor Instance is loaded or can be loaded.
	 *
	 * @return Newspack Editor Instance - Main instance.
	 */
	public static function instance() {
		if ( is_null( self::$instance ) ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	public function __construct() {
		add_action( 'init', [ __CLASS__, 'register_blocks' ] );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_scripts' ] );
		add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'enqueue_block_editor_assets' ] );
	}

	/**
	 * Enqueue front-end scripts.
	 */
	public static function enqueue_scripts() {
		wp_enqueue_style(
			'newspack-newsletters-blocks',
			plugins_url( '../dist/blocks.css', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/blocks.css' )
		);
	}

	/**
	 * Register blocks.
	 */
	public static function register_blocks() {
		register_block_type(
			'newspack-newsletters/subscribe',
			[
				'category'        => 'widgets',
				'attributes'      => [
					'placeholder'  => [
						'type'    => 'string',
						'default' => __( 'Enter your email address', 'newspack-newsletters' ),
					],
					'button_label' => [
						'type'    => 'string',
						'default' => __( 'Subscribe', 'newspack-newsletters' ),
					],
				],
				'supports'        => [ 'align' ],
				'render_callback' => [ __CLASS__, 'render_subscribe_block' ],
			]
		);
	}

	/**
	 * Render Subscribe Block.
	 *
	 * @param array[] $attrs Block attributes.
	 */
	public static function render_subscribe_block( $attrs ) {
		ob_start();
		?>
		<div class="newspack-newsletters-subscribe-block">
			<form>
				<input type="email" placeholder="<?php echo esc_attr( $attrs['placeholder'] ); ?>" />
				<button><?php echo esc_html( $attrs['button_label'] ); ?></button>
			</form>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Enqueue blocks scripts and styles for editor.
	 */
	public static function enqueue_block_editor_assets() {
		wp_enqueue_script(
			'newspack-newsletters-blocks',
			plugins_url( '../dist/blocks.js', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/blocks.js' ),
			true
		);
		wp_enqueue_style(
			'newspack-newsletters-blocks',
			plugins_url( '../dist/blocks.css', __FILE__ ),
			[],
			filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/blocks.css' )
		);
	}
}
Newspack_Newsletters_Blocks::instance();

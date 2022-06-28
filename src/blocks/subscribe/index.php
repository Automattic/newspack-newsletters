<?php
/**
 * Newspack Blocks.
 *
 * @package Newspack
 */

namespace Newspack_Newsletters\Blocks\Subscribe;

defined( 'ABSPATH' ) || exit;

const FORM_ACTION = 'newspack_newsletters_subscribe';

/**
 * Register block from metadata.
 */
function register_block() {
	register_block_type_from_metadata(
		__DIR__ . '/block.json',
		array(
			'render_callback' => __NAMESPACE__ . '\\render_block',
		)
	);
}
add_action( 'init', __NAMESPACE__ . '\\register_block' );

/**
 * Enqueue front-end scripts.
 */
function enqueue_scripts() {
	$handle = 'newspack-newsletters-subscribe-block';
	\wp_enqueue_style(
		$handle,
		plugins_url( '../../../dist/subscribeBlock.css', __FILE__ ),
		[],
		filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/subscribeBlock.css' )
	);
	\wp_enqueue_script(
		$handle,
		plugins_url( '../../../dist/subscribeBlock.js', __FILE__ ),
		[ 'wp-polyfill' ],
		filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/subscribeBlock.js' ),
		true
	);
	\wp_script_add_data( $handle, 'async', true );
	\wp_script_add_data( $handle, 'amp-plus', true );
}
add_action( 'wp_enqueue_scripts', __NAMESPACE__ . '\\enqueue_scripts' );

/**
 * Render Registration Block.
 *
 * @param array[] $attrs Block attributes.
 */
function render_block( $attrs ) {
	ob_start();
	?>
	<div class="newspack-newsletters-subscribe <?php echo esc_attr( get_block_classes( $attrs ) ); ?>">
		<form>
			<?php \wp_nonce_field( FORM_ACTION, FORM_ACTION ); ?>
			<input type="email" name="email" autocomplete="email" placeholder="<?php echo \esc_attr( $attrs['placeholder'] ); ?>" />
			<input type="submit" value="<?php echo \esc_attr( $attrs['label'] ); ?>" />
		</form>
	</div>
	<?php
	return ob_get_clean();
}

/**
 * Utility to assemble the class for a server-side rendered block.
 *
 * @param array $attrs Block attributes.
 * @param array $extra Additional classes to be added to the class list.
 *
 * @return string Class list separated by spaces.
 */
function get_block_classes( $attrs = [], $extra = [] ) {
	$classes = [];
	if ( isset( $attrs['align'] ) && ! empty( $attrs['align'] ) ) {
		$classes[] = 'align' . $attrs['align'];
	}
	if ( isset( $attrs['className'] ) ) {
		array_push( $classes, $attrs['className'] );
	}
	if ( is_array( $extra ) && ! empty( $extra ) ) {
		$classes = array_merge( $classes, $extra );
	}
	return implode( ' ', $classes );
}

/**
 * Process registration form.
 */
function process_form() {
	if ( ! isset( $_REQUEST[ FORM_ACTION ] ) || ! \wp_verify_nonce( \sanitize_text_field( $_REQUEST[ FORM_ACTION ] ), FORM_ACTION ) ) {
		return;
	}

	if ( ! isset( $_REQUEST['email'] ) || empty( $_REQUEST['email'] ) ) {
		return;
	}

	$email = \sanitize_email( $_REQUEST['email'] );

	// TODO Subscribe user.
	$result = false;

	/**
	 * Fires after a reader is registered through the Reader Registration Block.
	 *
	 * @param string              $email   Email address of the reader.
	 * @param int|false|\WP_Error $user_id The created user ID in case of registration, false if not created or a WP_Error object.
	 */
	\do_action( 'newspack_newsletters_subscribe_form_processed', $email, $user_id );

	if ( \wp_is_json_request() ) {
		if ( ! \is_wp_error( $result ) ) {
			$message = __( 'Thank you for registering!', 'newspack' );
		} else {
			$message = $result->get_error_message();
		}
		\wp_send_json( compact( 'message', 'email' ), \is_wp_error( $result ) ? 400 : 200 );
		exit;
	} elseif ( isset( $_SERVER['REQUEST_METHOD'] ) && 'GET' === $_SERVER['REQUEST_METHOD'] ) {
		\wp_safe_redirect(
			\add_query_arg(
				[ 'newspack_newsletters_subscribed' => is_wp_error( $result ) ? '0' : '1' ],
				\remove_query_arg( [ '_wp_http_referer', 'newspack_newsletters_subscribe', 'email' ] )
			)
		);
		exit;
	}
}
add_action( 'template_redirect', __NAMESPACE__ . '\\process_form' );

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
	$list_config = \Newspack_Newsletters_Subscribe::get_lists_config();
	ob_start();
	?>
	<div class="newspack-newsletters-subscribe <?php echo esc_attr( get_block_classes( $attrs ) ); ?>">
		<form>
			<?php \wp_nonce_field( FORM_ACTION, FORM_ACTION ); ?>
			<div class="newspack-newsletters-email-input">
				<input type="email" name="email" autocomplete="email" placeholder="<?php echo \esc_attr( $attrs['placeholder'] ); ?>" />
			</div>
			<?php if ( 1 < count( $attrs['lists'] ) ) : ?>
				<ul class="newspack-newsletters-lists">
					<?php
					foreach ( $attrs['lists'] as $list_id ) :
						if ( ! isset( $list_config[ $list_id ] ) ) {
							continue;
						}
						$list        = $list_config[ $list_id ];
						$checkbox_id = sprintf( 'newspack-newsletters-list-checkbox-%s', $list_id );
						?>
						<li>
							<span class="list-checkbox">
								<input
									type="checkbox"
									name="lists[]"
									value="<?php echo \esc_attr( $list_id ); ?>"
									id="<?php echo \esc_attr( $checkbox_id ); ?>"
									checked
								/>
							</span>
							<span class="list-details">
								<label for="<?php echo \esc_attr( $checkbox_id ); ?>">
									<span class="list-title"><?php echo \esc_html( $list['title'] ); ?></span>
									<?php if ( $attrs['displayDescription'] ) : ?>
										<span class="list-description"><?php echo \esc_html( $list['description'] ); ?></span>
									<?php endif; ?>
								</label>
							</span>
						</li>
					<?php endforeach; ?>
				</ul>
			<?php else : ?>
				<input type="hidden" name="lists[]" value="<?php echo \esc_attr( $attrs['lists'][0] ); ?>" />
			<?php endif; ?>
			<input type="submit" value="<?php echo \esc_attr( $attrs['label'] ); ?>" />
		</form>
		<div class="newspack-newsletters-subscribe-response"></div>
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
	if ( 1 < count( $attrs['lists'] ) ) {
		$classes[] = 'multiple-lists';
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

	$result = false;

	if ( ! isset( $_REQUEST['lists'] ) || empty( $_REQUEST['lists'] ) ) {
		$result = new \WP_Error( 'no_lists', __( 'You must select a list.', 'newspack-newsletters' ) );
	}

	// TODO Subscribe user.

	/**
	 * Fires after a reader is registered through the Reader Registration Block.
	 *
	 * @param string              $email   Email address of the reader.
	 * @param int|false|\WP_Error $user_id The created user ID in case of registration, false if not created or a WP_Error object.
	 */
	\do_action( 'newspack_newsletters_subscribe_form_processed', $email, $user_id );

	if ( \wp_is_json_request() ) {
		if ( ! \is_wp_error( $result ) ) {
			$message = __( 'Thank you for subscribing!', 'newspack' );
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

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

	$use_captcha  = method_exists( '\Newspack\Recaptcha', 'can_use_captcha' ) && \Newspack\Recaptcha::can_use_captcha();
	$dependencies = [];
	if ( $use_captcha ) {
		$dependencies[] = \Newspack\Recaptcha::SCRIPT_HANDLE;
	}

	\wp_enqueue_script(
		$handle,
		plugins_url( '../../../dist/subscribeBlock.js', __FILE__ ),
		$dependencies,
		filemtime( NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist/subscribeBlock.js' ),
		true
	);
	\wp_localize_script(
		$handle,
		'newspack_newsletters_subscribe_block',
		[
			'recaptcha_error' => __( 'Error loading the reCaptcha library.', 'newspack-newsletters' ),
			'invalid_email'   => __( 'Please enter a valid email address', 'newspack-newsletter' ),
		]
	);
	\wp_script_add_data( $handle, 'async', true );
	\wp_script_add_data( $handle, 'amp-plus', true );
}

/**
 * Generate a unique ID for each subscription form.
 *
 * The ID for each form instance is unique only for each page render.
 * The main intent is to be able to pass this ID to analytics so we
 * can identify what type of form it is, so the ID doesn't need to be
 * predictable nor consistent across page renders.
 *
 * @return string A unique ID string to identify the form.
 */
function get_form_id() {
	return \wp_unique_id( 'newspack-subscribe-' );
}

/**
 * Render a honeypot field to guard against bot form submissions. Note that
 * this field is named `email` to hopefully catch more bots who might be
 * looking for such fields, where as the "real" field is named "npe".
 *
 * Not rendered if reCAPTCHA is enabled as it's a superior spam protection.
 *
 * @param string $placeholder Placeholder text to render in the field.
 */
function render_honeypot_field( $placeholder = '' ) {
	if ( method_exists( 'Newspack\Recaptcha', 'can_use_captcha' ) && \Newspack\Recaptcha::can_use_captcha() ) {
		return;
	}

	if ( empty( $placeholder ) ) {
		$placeholder = __( 'Enter your email address', 'newspack-plugin' );
	}
	?>
	<input class="nphp" tabindex="-1" aria-hidden="true" name="email" type="email" autocomplete="off" placeholder="<?php echo \esc_attr( $placeholder ); ?>" />
	<?php
}

/**
 * Render Registration Block.
 *
 * @param array[] $attrs Block attributes.
 */
function render_block( $attrs ) {
	$list_config = \Newspack_Newsletters_Subscription::get_lists_config();
	if ( empty( $list_config ) || \is_wp_error( $list_config ) ) {
		return;
	}
	$block_id        = \wp_rand( 0, 99999 );
	$subscribed      = false;
	$message         = '';
	$email           = '';
	$lists           = array_keys( $list_config );
	$list_map        = array_flip( $lists );
	$available_lists = array_values( array_intersect( $attrs['lists'], $lists ) );

	if ( empty( $available_lists ) ) {
		$available_lists = [ $lists[0] ];
	}

	/**
	 * Filters the lists that are about to be displayed in the Subscription block
	 *
	 * @param array $available_lists The lists that are about to be displayed.
	 * @param array $attrs           Block attributes.
	 */
	$available_lists = apply_filters( 'newspack_newsletters_subscription_block_available_lists', $available_lists, $attrs );

	if ( empty( $available_lists ) ) {
		return;
	}

	$provider = \Newspack_Newsletters::get_service_provider();

	// Enqueue scripts.
	enqueue_scripts();

	if ( \is_user_logged_in() ) {
		$email = \wp_get_current_user()->user_email;
	} elseif ( class_exists( '\Newspack\Reader_Activation' ) ) {
		try {
			if ( \Newspack\Reader_Activation::is_enabled() ) {
				$email = \Newspack\Reader_Activation::get_auth_intention_value();
			}
		} catch ( \Throwable $th ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
			// Fail silently.
		}
	}

	// phpcs:disable WordPress.Security.NonceVerification.Recommended
	if ( isset( $_REQUEST['newspack_newsletters_subscribed'] ) ) {
		$subscribed = \absint( $_REQUEST['newspack_newsletters_subscribed'] );
		if ( isset( $_REQUEST['message'] ) ) {
			$message = \sanitize_text_field( $_REQUEST['message'] );
		}
		if ( isset( $_REQUEST['npe'] ) ) {
			$email = \sanitize_text_field( $_REQUEST['npe'] );
		}
		if ( isset( $_REQUEST['lists'] ) && is_array( $_REQUEST['lists'] ) ) {
			$list_map = array_flip( array_map( 'sanitize_text_field', $_REQUEST['lists'] ) );
		}
	}

	// Handle checkbox checked state.
	if ( isset( $attrs['listsCheckboxes'] ) ) {
		foreach ( $list_map as $list_id => $list_index ) {
			if ( isset( $attrs['listsCheckboxes'][ $list_id ] ) && false === $attrs['listsCheckboxes'][ $list_id ] ) {
				unset( $list_map[ $list_id ] );
			}
		}
	}

	$display_input_label = ! empty( $attrs['displayInputLabels'] );
	$email_label         = $display_input_label ? $attrs['emailLabel'] : '';
	$input_id            = sprintf( 'newspack-newsletters-subscribe-block-input-%s', $block_id );
	// phpcs:enable
	ob_start();
	?>
	<div
		class="wp-block-newspack-newsletters-subscribe newspack-newsletters-subscribe <?php echo esc_attr( get_block_classes( $attrs ) ); ?>"
		data-success-message="<?php echo \esc_attr( $attrs['successMessage'] ); ?>"
		<?php echo $subscribed ? 'data-status="200"' : ''; ?>
	>
		<?php if ( ! $subscribed ) : ?>
			<form id="<?php echo esc_attr( get_form_id() ); ?>">
				<?php \wp_nonce_field( FORM_ACTION, FORM_ACTION ); ?>
				<?php
				/**
				 * Action to add custom fields before the form fields of the Newsletter Subscription block.
				 *
				 * @param array $attrs Block attributes.
				 */
				do_action( 'newspack_newsletters_subscribe_block_before_form_fields', $attrs );
				?>
				<?php if ( 1 < count( $available_lists ) ) : ?>
					<div class="newspack-newsletters-lists">
						<ul>
						<?php
						foreach ( $available_lists as $list_id ) :
							if ( ! isset( $list_config[ $list_id ] ) ) {
								continue;
							}
							$list        = $list_config[ $list_id ];
							$checkbox_id = sprintf( 'newspack-newsletters-%s-list-checkbox-%s', $block_id, $list_id );
							?>
							<li>
								<span class="list-checkbox">
									<input
										type="checkbox"
										name="lists[]"
										value="<?php echo \esc_attr( $list_id ); ?>"
										id="<?php echo \esc_attr( $checkbox_id ); ?>"
										<?php if ( isset( $list_map[ $list_id ] ) ) : ?>
											checked
										<?php endif; ?>
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
					</div>
				<?php else : ?>
					<input type="hidden" name="lists[]" value="<?php echo \esc_attr( $available_lists[0] ); ?>" />
				<?php endif; ?>
				<?php
				if ( $attrs['displayNameField'] ) :
					$name_label            = $attrs['nameLabel'];
					$name_placeholder      = $attrs['namePlaceholder'];
					$last_name_label       = $attrs['lastNameLabel'];
					$last_name_placeholder = $attrs['lastNamePlaceholder'];
					$display_last_name     = $attrs['displayLastNameField'];
					?>
					<div class="newspack-newsletters-name-input">

						<div class="newspack-newsletters-name-input-item">
							<?php if ( $display_input_label ) : ?>
								<label for="<?php echo \esc_attr( $input_id . '-name' ); ?>"><?php echo \esc_html( $name_label ); ?></label>
							<?php endif; ?>
							<input id="<?php echo \esc_attr( $input_id . '-name' ); ?>" type="text" name="name" placeholder="<?php echo \esc_attr( $name_placeholder ); ?>" />
						</div>
						<?php if ( $display_last_name ) : ?>
							<div class="newspack-newsletters-name-input-item">
								<?php if ( $display_input_label ) : ?>
									<label for="<?php echo \esc_attr( $input_id . '-last-name' ); ?>"><?php echo \esc_html( $last_name_label ); ?></label>
								<?php endif; ?>
								<input id="<?php echo \esc_attr( $input_id . '-last-name' ); ?>" type="text" name="last_name" placeholder="<?php echo \esc_attr( $last_name_placeholder ); ?>" />
							</div>
						<?php endif; ?>
					</div>
				<?php endif; ?>
				<?php do_action( 'newspack_newsletters_subscribe_block_before_email_field', $attrs ); ?>
				<div class="newspack-newsletters-email-input">
					<?php if ( $email_label ) : ?>
						<label for="<?php echo \esc_attr( $input_id . '-email' ); ?>"><?php echo \esc_html( $email_label ); ?></label>
					<?php endif; ?>
					<input
						id="<?php echo \esc_attr( $input_id . '-email' ); ?>"
						type="email"
						name="npe"
						autocomplete="email"
						placeholder="<?php echo \esc_attr( $attrs['placeholder'] ); ?>"
						value="<?php echo esc_attr( $email ); ?>"
					/>
					<?php render_honeypot_field( $attrs['placeholder'] ); ?>
					<?php if ( $provider && 'mailchimp' === $provider->service && $attrs['mailchimpDoubleOptIn'] ) : ?>
						<input type="hidden" name="double_optin" value="1" />
					<?php endif; ?>

					<button class="<?php echo \esc_attr( get_block_button_classes( $attrs ) ); ?>"type="submit" style="<?php echo \esc_attr( get_block_button_styles( $attrs ) ); ?>">
						<span class="submit"><?php echo \esc_html( $attrs['label'] ); ?></span>
					</button>
				</div>
			</form>
		<?php endif; ?>
		<div class="newspack-newsletters-subscribe__response">
			<div class="newspack-newsletters-subscribe__icon"></div>
			<div class="newspack-newsletters-subscribe__message">
				<?php if ( ! empty( $message ) || $subscribed ) : ?>
					<p><?php echo $subscribed ? \wp_kses_post( $attrs['successMessage'] ) : \esc_html( $message ); ?></p>
				<?php endif; ?>
			</div>
		</div>
	</div>
	<?php
	return ob_get_clean();
}

/**
 * Utility to assemble the class for a server-side rendered block.
 *
 * @param array $attrs Block attributes.
 *
 * @return string Class list separated by spaces.
 */
function get_block_classes( $attrs = [] ) {
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
	return implode( ' ', $classes );
}

/**
 * Check if button text is set to the default color.
 *
 * @param array $attrs Block attributes.
 *
 * @return bool Whether text color is default.
 */
function is_button_text_default( $attrs = [] ) {
	if ( '#ffffff' === $attrs['textColor'] ) {
		return true;
	}
	return false;
}

/**
 * Check if button background is set to the default color.
 *
 * @param array $attrs Block attributes.
 *
 * @return bool Whether background color is default.
 */
function is_button_background_default( $attrs = [] ) {
	if ( '#dd3333' === $attrs['backgroundColor'] ) {
		return true;
	}
	return false;
}

/**
 * Utility to assemble the class for a server-side rendered block button.
 *
 * @param array $attrs Block attributes.
 *
 * @return string Class list separated by spaces.
 */
function get_block_button_classes( $attrs = [] ) {
	$classes[] = 'submit-button';

	if ( ! is_button_text_default( $attrs ) ) {
		$classes[] = 'has-text-color';
	}

	if ( ! is_button_background_default( $attrs ) ) {
		$classes[] = 'has-background-color';
	}

	if ( '' !== $attrs['backgroundColorName'] ) {
		$classes[] = 'has-' . $attrs['backgroundColorName'] . '-background-color';
	}

	if ( '' !== $attrs['textColorName'] ) {
		$classes[] = 'has-' . $attrs['textColorName'] . '-color';
	}

	return implode( ' ', $classes );
}

/**
 * Utility to assemble the styles for a server-side rendered block button.
 *
 * @param array $attrs Block attributes.
 *
 * @return string Class list separated by spaces.
 */
function get_block_button_styles( $attrs = [] ) {
	$style = '';

	if ( ! is_button_text_default( $attrs ) ) {
		$style .= 'color: ' . $attrs['textColor'] . ';';
	}

	if ( ! is_button_background_default( $attrs ) ) {
		$style .= 'background-color: ' . $attrs['backgroundColor'] . ';';
	}
	return $style;
}

/**
 * Send the form response to the client, whether it's a JSON or GET request.
 *
 * @param mixed $data The response to send to the client.
 */
function send_form_response( $data ) {
	$is_error = \is_wp_error( $data );
	if ( \wp_is_json_request() ) {
		if ( $is_error ) {
			$message = $data->get_error_message();
			\wp_send_json( compact( 'message', 'data' ), 400 );
			exit;
		} else {
			$data['newspack_newsletters_subscribed'] = 1;
			\wp_send_json( $data, 200 );
			exit;
		}
	} elseif ( isset( $_SERVER['REQUEST_METHOD'] ) && 'GET' === $_SERVER['REQUEST_METHOD'] ) {
		$args_to_remove = [
			'_wp_http_referer',
			FORM_ACTION,
		];

		$args = [ 'newspack_newsletters_subscribed' => $is_error ? '0' : '1' ];

		if ( $is_error ) {
			$args['message'] = $data->get_error_code();
		} else {
			$args_to_remove = array_merge( $args_to_remove, [ 'email', 'lists' ] );
		}

		\wp_safe_redirect(
			\add_query_arg(
				$args,
				\remove_query_arg( $args_to_remove )
			)
		);
		exit;
	}
}

/**
 * Process newsletter signup form.
 */
function process_form() {
	if ( ! isset( $_REQUEST[ FORM_ACTION ] ) ) {
		return;
	}

	if ( ! \wp_verify_nonce( \sanitize_text_field( $_REQUEST[ FORM_ACTION ] ), FORM_ACTION ) ) {
		return send_form_response( new \WP_Error( 'invalid_nonce', __( 'Invalid request.', 'newspack-newsletters' ) ) );
	}

	// Honeypot trap.
	if ( ! empty( $_REQUEST['email'] ) ) {
		return send_form_response( [ 'email' => \sanitize_email( $_REQUEST['email'] ) ] );
	}

	// reCAPTCHA test.
	if ( method_exists( '\Newspack\Recaptcha', 'can_use_captcha' ) && \Newspack\Recaptcha::can_use_captcha() ) {
		$captcha_result = \Newspack\Recaptcha::verify_captcha();
		if ( \is_wp_error( $captcha_result ) ) {
			return send_form_response( $captcha_result );
		}
	}

	if ( ! isset( $_REQUEST['npe'] ) || empty( $_REQUEST['npe'] ) ) {
		return send_form_response( new \WP_Error( 'invalid_email', __( 'You must enter a valid email address.', 'newspack-newsletters' ) ) );
	}

	if ( ! isset( $_REQUEST['lists'] ) || ! is_array( $_REQUEST['lists'] ) || empty( $_REQUEST['lists'] ) ) {
		return send_form_response( new \WP_Error( 'no_lists', __( 'You must select a list.', 'newspack-newsletters' ) ) );
	}

	// The "true" email address field is called `npe` due to the honeypot strategy.
	$last_name = isset( $_REQUEST['last_name'] ) ? \sanitize_text_field( $_REQUEST['last_name'] ) : '';
	$name      = trim(
		sprintf(
			'%s %s',
			isset( $_REQUEST['name'] ) ? \sanitize_text_field( $_REQUEST['name'] ) : '',
			$last_name
		)
	);
	$email     = \sanitize_email( $_REQUEST['npe'] );
	$lists     = array_map( 'sanitize_text_field', $_REQUEST['lists'] );
	$popup_id  = isset( $_REQUEST['newspack_popup_id'] ) ? (int) $_REQUEST['newspack_popup_id'] : false;
	$metadata  = [
		'current_page_url'                => home_url( add_query_arg( array(), \wp_get_referer() ) ),
		'newspack_popup_id'               => $popup_id,
		'newsletters_subscription_method' => 'newsletters-subscription-block',
	];

	// Handle Mailchimp double opt-in option.
	$provider = \Newspack_Newsletters::get_service_provider();
	if ( $provider && 'mailchimp' === $provider->service && isset( $_REQUEST['double_optin'] ) && '1' === $_REQUEST['double_optin'] ) {
		$metadata['status'] = 'pending';
	}

	if ( ! \is_user_logged_in() && \class_exists( '\Newspack\Reader_Activation' ) && \Newspack\Reader_Activation::is_enabled() ) {
		$metadata = array_merge( $metadata, [ 'registration_method' => 'newsletters-subscription' ] );
		if ( $popup_id ) {
			$metadata['registration_method'] = 'newsletters-subscription-popup';
		}
		\Newspack\Reader_Activation::register_reader( $email, $name, true, $metadata );
	}

	$result = \Newspack_Newsletters_Subscription::add_contact(
		[
			'name'     => $name ?? null,
			'email'    => $email,
			'metadata' => $metadata,
		],
		$lists,
		true // Async.
	);

	// The async subscription strategy returns true.
	if ( true === $result ) {
		$result = [];
	}

	if ( \is_wp_error( $result ) ) {
		return send_form_response( $result );
	}

	/**
	 * Fires after subscribing a user to a list.
	 *
	 * @param string         $email  Email address of the reader.
	 * @param array|WP_Error $result Contact data if it was added, or error otherwise.
	 * @param array          $metadata Some metadata about the subscription. Always contains `current_page_url`, `newspack_popup_id` and `newsletters_subscription_method` keys.
	 */
	\do_action( 'newspack_newsletters_subscribe_form_processed', $email, $result, $metadata );

	// Generate a new nonce for subsequent form submissions.
	$result[ FORM_ACTION ] = \wp_create_nonce( FORM_ACTION );

	return send_form_response( $result );
}
add_action( 'template_redirect', __NAMESPACE__ . '\\process_form' );

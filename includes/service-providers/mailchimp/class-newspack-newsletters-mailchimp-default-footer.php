<?php
/**
 * Service Provider: Mailchimp Default Footer
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Usage reports for Mailchimp.
 */
class Newspack_Newsletters_Mailchimp_Default_Footer {

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'admin_footer', [ __CLASS__, 'add_footer_content_to_editor' ] );
	}
	/**
	 * Get the default Mailchimp footer content.
	 *
	 * @return string Footer content.
	 */
	public static function get_footer_content() {

		$should_append_footer = get_option( 'newspack_mailchimp_auto_append_footer', false );
		if ( ! $should_append_footer ) {
			return '';
		}
		$manage_preferences_url = 'http://*|UPDATE_PROFILE|*';
		if ( function_exists( 'wc_get_account_endpoint_url' ) && class_exists( 'Newspack\Reader_Activation' ) && method_exists( 'Newspack\Reader_Activation', 'is_enabled' ) && \Newspack\Reader_Activation::is_enabled() ) {
			$manage_preferences_url = wc_get_account_endpoint_url( Newspack_Newsletters_Subscription::WC_ENDPOINT );
		}
		return '<!-- wp:paragraph {"align":"center","fontSize":"small"} --><p class="has-text-align-center has-small-font-size"><br>This email was sent to *|EMAIL|*<br><a href="' . $manage_preferences_url . '">Update your preferences</a>&nbsp;—&nbsp;<a href="http://*|UNSUB|*">Unsubscribe from all *|LIST:COMPANY|* newsletters</a><br>*|LIST_ADDRESSLINE_TEXT|**|IF:REWARDS|*<br><br>*|HTML:REWARDS|* *|END:IF|*</p><!-- /wp:paragraph -->';
	}

	/**
	 * Add the default footer content to the editor.
	 */
	public static function add_footer_content_to_editor() {
		$screen = get_current_screen();
		if ( Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT !== $screen->post_type ) {
			return;
		}
		$footer_content = self::get_footer_content();
		if ( empty( $footer_content ) ) {
			return;
		}
		?>
		<script type="text/javascript">
			window.newspackMailchimpDefaultFooter = '<?php echo $footer_content; // phpcs:ignore?>';
		</script>
		<?php
	}
}

Newspack_Newsletters_Mailchimp_Default_Footer::init();

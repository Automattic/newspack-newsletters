<?php
/**
 * Service Provider: Mailchimp Default Footer
 *
 * @package Newspack
 */

defined( 'ABSPATH' ) || exit;

/**
 * Append default Mailchimp footer to all newsletter drafts when `newspack_mailchimp_auto_append_footer` is true.
 */
class Newspack_Newsletters_Mailchimp_Default_Footer {

	/**
	 * Get the default Mailchimp footer content.
	 *
	 * @return string Footer content.
	 */
	public static function get_footer_content() {

		$should_append_footer = 'mailchimp' === Newspack_Newsletters::service_provider() && get_option( 'newspack_mailchimp_auto_append_footer', false );
		if ( ! $should_append_footer ) {
			return '';
		}
		$manage_preferences_url = 'http://*|UPDATE_PROFILE|*';
		if ( function_exists( 'wc_get_account_endpoint_url' ) && method_exists( 'Newspack\Reader_Activation', 'is_enabled' ) && \Newspack\Reader_Activation::is_enabled() ) {
			$manage_preferences_url = wc_get_account_endpoint_url( Newspack_Newsletters_Subscription::WC_ENDPOINT );
		}
		return '<!-- wp:paragraph {"align":"center","fontSize":"small"} --><p class="has-text-align-center has-small-font-size"><br>This email was sent to *|EMAIL|*<br><a href="' . esc_url( $manage_preferences_url ) . '">Update your preferences</a>&nbsp;—&nbsp;<a href="http://*|UNSUB|*">Unsubscribe from all *|LIST:COMPANY|* newsletters</a><br>*|LIST_ADDRESSLINE_TEXT|**|IF:REWARDS|*<br><br>*|HTML:REWARDS|* *|END:IF|*</p><!-- /wp:paragraph -->';
	}
}

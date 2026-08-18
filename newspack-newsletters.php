<?php
/**
 * Plugin Name:     Newspack Newsletters (final version, please migrate)
 * Plugin URI:      https://newspack.com
 * Description:     Final version released from the legacy plugin repository. This copy will not receive further updates. Download the current version at https://newspack.com/download-center
 * Author:          Automattic
 * Author URI:      https://newspack.com/
 * License: GPL2
 * Text Domain:     newspack-newsletters
 * Domain Path:     /languages
 * Version:         3.33.5
 *
 * @package         Newspack_Newsletters
 */

defined( 'ABSPATH' ) || exit;

// Define NEWSPACK_NEWSLETTERS_PLUGIN_FILE.
if ( ! defined( 'NEWSPACK_NEWSLETTERS_PLUGIN_FILE' ) ) {
	define( 'NEWSPACK_NEWSLETTERS_PLUGIN_FILE', plugin_dir_path( __FILE__ ) );
}

/**
 * API endpoint for Letterhead integration.
 * Override for development or to use a different instance.
 *
 * @constant NEWSPACK_NEWSLETTERS_LETTERHEAD_ENDPOINT
 * @type     string
 * @default  https://api.tryletterhead.com
 * @status   draft
 *
 * @example define( 'NEWSPACK_NEWSLETTERS_LETTERHEAD_ENDPOINT', 'https://custom-api.example.com' );
 */
if ( ! defined( 'NEWSPACK_NEWSLETTERS_LETTERHEAD_ENDPOINT' ) ) {
	define( 'NEWSPACK_NEWSLETTERS_LETTERHEAD_ENDPOINT', 'https://api.tryletterhead.com' );
}
// Include main plugin resources.
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/vendor/autoload.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-logger.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/interface-newspack-newsletters-esp-service.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/interface-newspack-newsletters-wp-hookable.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/class-newspack-newsletters-service-provider.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/class-newspack-newsletters-service-provider-controller.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/class-newspack-newsletters-service-provider-usage-report.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/mailchimp/class-newspack-newsletters-mailchimp-groups.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/mailchimp/class-newspack-newsletters-mailchimp.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/mailchimp/class-newspack-newsletters-mailchimp-controller.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/mailchimp/class-newspack-newsletters-mailchimp-cached-data.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/mailchimp/class-newspack-newsletters-mailchimp-usage-reports.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/mailchimp/class-newspack-newsletters-mailchimp-notes.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/mailchimp/class-newspack-newsletters-mailchimp-subscription-list-trait.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/constant_contact/class-newspack-newsletters-constant-contact.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/constant_contact/class-newspack-newsletters-constant-contact-controller.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/constant_contact/class-newspack-newsletters-constant-contact-sdk.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/constant_contact/class-newspack-newsletters-constant-contact-usage-reports.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/active_campaign/class-newspack-newsletters-active-campaign.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/active_campaign/class-newspack-newsletters-active-campaign-controller.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/active_campaign/class-newspack-newsletters-active-campaign-usage-reports.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/letterhead/class-newspack-newsletters-letterhead.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/letterhead/dtos/class-newspack-newsletters-letterhead-promotion-dto.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/service-providers/letterhead/models/class-newspack-newsletters-letterhead-promotion.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-subscription.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-blocks.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-editor.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-layouts.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-settings.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-renderer.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-bulk-actions.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-quick-edit.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-embed.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters-subscription-attempts.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/ads/class-ads.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/tracking/class-utils.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/tracking/class-pixel.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/tracking/class-click.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/tracking/class-admin.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/class-newspack-newsletters.php';
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . '/includes/plugins/woocommerce-memberships/class-woocommerce-memberships.php';

// This MUST be initialized after Newspack_Newsletter class.
\Newspack\Newsletters\Subscription_Lists::init();
\Newspack\Newsletters\Send_Lists::init();

/**
 * Warn administrators that this build came from the legacy plugin repository.
 */
function newspack_newsletters_legacy_repo_notice() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="notice notice-error">
		<p><strong><?php esc_html_e( 'You are running an outdated version of the Newspack Newsletters plugin.', 'newspack-newsletters' ); ?></strong></p>
		<p>
			<?php
			printf(
				wp_kses(
					/* translators: 1: URL of the announcement post. 2: URL of the download center. */
					__( 'This is the final version released from the legacy plugin repository, and it will not receive further updates. <a href="%1$s">Read the announcement</a>, then download the current version from the <a href="%2$s">Newspack download center</a>.', 'newspack-newsletters' ),
					[
						'a' => [
							'href' => [],
						],
					]
				),
				esc_url( 'https://newspack.com/newspack-plugins-and-themes-have-a-new-home/' ),
				esc_url( 'https://newspack.com/download-center' )
			);
			?>
		</p>
	</div>
	<?php
}

/*
 * Newspack wizard screens call remove_all_actions() on the notice hooks at priority -9999,
 * so this notice runs ahead of that to stay visible on every admin screen.
 */
add_action( 'all_admin_notices', 'newspack_newsletters_legacy_repo_notice', -99999 );

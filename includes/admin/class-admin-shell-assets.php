<?php
/**
 * Admin shell — asset enqueue.
 *
 * Owns the admin-shell bundle enqueue and the inline-script patch that
 * fixes the newspack-plugin wizard header's tab-selection state on
 * hidden React subpages.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin;

use Newspack_Newsletters;

defined( 'ABSPATH' ) || exit;

/**
 * Asset enqueue.
 */
class Admin_Shell_Assets {
	const SCRIPT_HANDLE = 'newspack-newsletters-admin-shell';

	/**
	 * Boot hooks.
	 */
	public static function init() {
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue' ] );
		// Priority 99 so we run after newspack-plugin's wizard header
		// has registered its script — `wp_add_inline_script` needs the
		// handle in place to attach.
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'patch_wizard_header_active_tab' ], 99 );
	}

	/**
	 * Enqueue the shared admin-shell bundle on registered admin pages.
	 * Pages contribute style deps via `get_admin_shell_style_deps()` and
	 * sibling enqueues via `enqueue_extras()` so this method stays
	 * branch-free.
	 */
	public static function enqueue() {
		$current_page = Admin_Shell::get_current_page();
		if ( ! $current_page ) {
			return;
		}

		$asset = Asset_Loader::enqueue_bundle(
			self::SCRIPT_HANDLE,
			'admin-shell',
			NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'dist',
			plugins_url( '../../dist', __FILE__ ),
			[],
			$current_page->get_admin_shell_style_deps()
		);
		if ( ! $asset ) {
			return;
		}

		$current_page->enqueue_extras( self::SCRIPT_HANDLE );

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'newspackNewslettersAdmin',
			[
				'currentPage'     => $current_page->get_slug(),
				'mountId'         => $current_page->get_mount_id(),
				'label'           => $current_page->get_label(),
				'bundledMode'     => Admin_Shell::is_bundled_mode(),
				'classicSettings' => \Newspack_Newsletters_Settings::get_settings_url(),
				'restNonce'       => wp_create_nonce( 'wp_rest' ),
				'restUrl'         => esc_url_raw( rest_url() ),
				// `admin_url()` rather than assuming `/wp-admin/` lives at the document origin — subdirectory and multisite installs put it under a path.
				'adminUrl'        => esc_url_raw( admin_url() ),
				'cptSlug'         => Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT,
			]
		);
	}

	/**
	 * Patch the newspack-plugin wizard header's "selected" tab state
	 * for hidden React subpages. The wizard's `WizardsAdminHeader`
	 * (`src/wizards/admin-header/index.tsx`) decides the active tab
	 * via strict `window.location.href === tab.href` equality, which
	 * breaks for our hidden React subpages — the live URL has an
	 * extra `&page=…` query the tab href doesn't carry. Each page
	 * declares the canonical tab URL via `get_wizard_tab_url()`; we
	 * inject a tiny inline script after the wizard header script to
	 * flip the matching `<a>` to `.selected` once the React component
	 * has mounted. Runs only when the wizard header script is
	 * registered (i.e. bundled mode + the wizard recognises the
	 * screen — for ads, that's via `Newsletters_Wizard::get_tabs()`).
	 *
	 * Upstream fix tracked separately; the wizard's URL-equality
	 * check should accept subpages so this workaround can be removed.
	 */
	public static function patch_wizard_header_active_tab() {
		$current_page = Admin_Shell::get_current_page();
		if ( ! $current_page ) {
			return;
		}
		if ( ! wp_script_is( 'newspack-wizards-admin-header', 'registered' ) ) {
			return;
		}

		$tab_url           = $current_page->get_wizard_tab_url();
		$breadcrumb_label  = $current_page->get_wizard_header_label();

		if ( null === $tab_url && null === $breadcrumb_label ) {
			return;
		}

		// Single inline-script payload covers both patches. Each runs
		// independently — the wizard renders its DOM after this script is
		// parsed, so we observe document.body and re-apply on every
		// mutation until the targets exist (and once after, to defend
		// against React rerenders that swap the nodes).
		$tab_url_json    = null === $tab_url ? 'null' : wp_json_encode( $tab_url );
		$breadcrumb_json = null === $breadcrumb_label ? 'null' : wp_json_encode( $breadcrumb_label );

		// The wizard renders its DOM after this script is parsed and may
		// re-render its header on route changes, so the observer waits
		// for the targets, patches once both are present, and then
		// disconnects. A deferred follow-up apply() run catches an
		// immediate post-mount rerender without leaving the observer
		// attached for the lifetime of the page.
		wp_add_inline_script(
			'newspack-wizards-admin-header',
			sprintf(
				'( function () {
					var tabUrl = %1$s;
					var breadcrumb = %2$s;
					var observer = null;
					function apply() {
						var tabDone = ! tabUrl;
						var breadcrumbDone = ! breadcrumb;
						if ( tabUrl ) {
							var links = document.querySelectorAll( ".newspack-tabbed-navigation a" );
							links.forEach( function ( link ) {
								if ( link.href === tabUrl ) {
									link.classList.add( "selected" );
								}
							} );
							tabDone = links.length > 0;
						}
						if ( breadcrumb ) {
							var heading = document.querySelector( ".newspack-wizard__title h2" );
							if ( heading ) {
								if ( heading.textContent !== breadcrumb ) {
									heading.textContent = breadcrumb;
								}
								breadcrumbDone = true;
							}
						}
						if ( tabDone && breadcrumbDone && observer ) {
							observer.disconnect();
							observer = null;
							setTimeout( function () {
								apply();
							}, 0 );
						}
					}
					apply();
					var root = document.querySelector( ".newspack-wizard" ) || document.body;
					observer = new MutationObserver( apply );
					observer.observe( root, { childList: true, subtree: true } );
				} )();',
				$tab_url_json,
				$breadcrumb_json
			)
		);
	}
}

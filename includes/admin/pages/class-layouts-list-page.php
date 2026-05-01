<?php
/**
 * Newsletter Layouts list admin page (React DataView).
 *
 * First-class management surface for saved newsletter layouts
 * (`newspack_nl_layo_cpt`). Distinct from the layout-picker /
 * authoring UX (NEWS-1909 / 1910 / 1911) — this is the *list* of
 * user-created layouts: edit / duplicate / rename / delete.
 *
 * Conditional registration: the menu is registered only when the
 * site has at least one saved layout. Saved layouts are born
 * exclusively from the editor's "Save as layout" action, so until
 * then the surface deliberately doesn't exist for the user. Gating
 * lives in `Admin_Shell::get_pages()` (mirrors the bundled-mode
 * gate used by `Settings_Page`); zero existing chassis virtuals
 * had to grow for this.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters\Admin\Pages;

use Newspack\Newsletters\Admin\Admin_Page;
use Newspack_Newsletters;

defined( 'ABSPATH' ) || exit;

/**
 * "Layouts" list page — shown only when ≥1 saved layout exists.
 */
class Layouts_List_Page extends Admin_Page {
	/**
	 * Page slug.
	 *
	 * @var string
	 */
	protected $slug = 'newspack-newsletters-layouts-list';

	/**
	 * Capability required to view the page.
	 *
	 * Matches the gate `Newspack_Newsletters_Layouts::register_layout_cpt`
	 * applies to the CPT itself — without `edit_others_posts` the CPT
	 * isn't registered, so the standard `/wp/v2/newspack_nl_layo_cpt`
	 * REST collection wouldn't be reachable. Aligning the page
	 * capability prevents an "I can see the menu but everything 404s"
	 * mismatch.
	 *
	 * @var string
	 */
	protected $capability = 'edit_others_posts';

	/**
	 * Get the page label.
	 *
	 * @return string
	 */
	public function get_label() {
		return __( 'Layouts', 'newspack-newsletters' );
	}

	/**
	 * Submenu under the Newsletters CPT menu — same parent the existing
	 * chassis pages register against. The layouts CPT itself is
	 * `'public' => false` and has no menu entry of its own, so there is
	 * no legacy admin URL to shadow.
	 *
	 * @return string
	 */
	public function get_parent_slug() {
		return 'edit.php?post_type=' . Newspack_Newsletters::NEWSPACK_NEWSLETTERS_CPT;
	}

	/**
	 * Whether the site has at least one saved layout.
	 *
	 * Saved layouts are stored exclusively as `status=publish` posts of
	 * the layouts CPT (see `SingleLayoutPreview` and the editor's
	 * `saveLayout` dispatch). `private` is included defensively so a
	 * future status drift doesn't silently hide the menu. Result is
	 * memoised per-request because `Admin_Shell::get_pages()` is called
	 * from multiple hook callbacks and there's no need to re-query.
	 *
	 * @return bool
	 */
	public static function has_saved_layouts() {
		static $cached = null;
		if ( null !== $cached ) {
			return $cached;
		}

		// `wp_count_posts` is a single SQL aggregate keyed by post_status —
		// cheap enough to run on every admin request without caching the
		// result beyond the static memo above.
		$counts = \wp_count_posts( \Newspack_Newsletters_Layouts::NEWSPACK_NEWSLETTERS_LAYOUT_CPT );
		$total  = (int) ( $counts->publish ?? 0 ) + (int) ( $counts->private ?? 0 );
		$cached = $total > 0;
		return $cached;
	}
}

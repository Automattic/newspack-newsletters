/**
 * URL-driven initial view state for the Layouts list.
 *
 * The Layouts page has no legacy admin URL to redirect from (the
 * layouts CPT is `'public' => false` and never surfaced its own
 * `edit.php?post_type=…` admin screen). Even so, expose the same
 * shape the Advertisers / Ads / Newsletters lists do so deep links
 * the chassis may forward in future continue to work, and so
 * URL-shareable filter / sort state is supported day-one.
 */

import { makeGetInitialView } from '../../utils/initial-view';

const ORDERBY_TO_SORT_FIELD = {
	title: 'title',
	modified: 'modified',
	date: 'date',
};

export const { getInitialView } = makeGetInitialView( {
	orderbyMap: ORDERBY_TO_SORT_FIELD,
} );

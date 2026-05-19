/**
 * URL-driven initial view state for the Advertisers list DataView.
 *
 * `Admin_Shell::maybe_redirect_legacy_list` forwards a curated set of
 * query args from the legacy `edit-tags.php?taxonomy=newspack_nl_advertiser`
 * URL onto the React page (search term, sort field, sort direction).
 * Translate those raw values into DataViews-shaped state so a deep link
 * like `…&s=acme&orderby=slug` lands on the matching filtered + sorted
 * list rather than the unfiltered default.
 *
 * Pure module so it stays trivial to unit-test.
 */

import { makeGetInitialView } from '../../utils/initial-view';

// Map the WP REST terms controller `orderby` values that the React
// DataView fields here also expose. `id` / `include` / `term_group`
// are accepted by REST but the DataView has no field for them, so a
// legacy URL using those values falls through to the default sort
// rather than producing an invalid state.
const ORDERBY_TO_SORT_FIELD = {
	name: 'name',
	slug: 'slug',
	count: 'count',
};

// Alphabetical lists default to ascending; everywhere else the default
// is descending.
export const { getInitialView } = makeGetInitialView( {
	orderbyMap: ORDERBY_TO_SORT_FIELD,
	defaultSortDirection: 'asc',
} );

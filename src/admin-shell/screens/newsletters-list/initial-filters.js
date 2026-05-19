/**
 * URL-driven initial view state for the Newsletters list DataView.
 *
 * `Admin_Shell::maybe_redirect_legacy_list` forwards a curated set of
 * query args from the legacy `edit.php?post_type=newspack_nl_cpt` URL
 * onto the React page (status filter, search term, sort field, sort
 * direction). Translate those raw values into DataViews-shaped state.
 *
 * Pure module so it stays trivial to unit-test.
 */

import { makeGetInitialView } from '../../utils/initial-view';

const POST_STATUS_TO_FILTER_VALUE = {
	trash: 'trash',
	draft: 'draft,pending,auto-draft',
	pending: 'draft,pending,auto-draft',
	'auto-draft': 'draft,pending,auto-draft',
	future: 'future',
	publish: 'publish,private',
	private: 'publish,private',
};

// Inverse of the JS-side `SORT_FIELD_TO_ORDERBY` in build-query: map
// REST `orderby` values back onto the DataView field id our `getFields`
// configuration uses.
const ORDERBY_TO_SORT_FIELD = {
	title: 'title',
	date: 'date',
	author: 'author',
};

// URL param → DataView filter field; mirrors build-query's reverse mapping.
const URL_PARAM_TO_FILTER_FIELD = {
	author: 'author',
	categories: 'categories',
	tags: 'tags',
	newspack_newsletters_send_list_id: 'send_list',
};

export const { getInitialFilters, getInitialView } = makeGetInitialView( {
	orderbyMap: ORDERBY_TO_SORT_FIELD,
	postStatusMap: POST_STATUS_TO_FILTER_VALUE,
	urlParamToFilterField: URL_PARAM_TO_FILTER_FIELD,
} );

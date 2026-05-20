/**
 * Translate a DataViews `view` object into the query string used by
 * `/wp/v2/newspack_nl_cpt`. Pure function so it's trivial to test.
 *
 * View shape (subset we care about):
 *   { page, perPage, sort?: { field, direction }, search?, filters?: [{ field, operator, value }] }
 *
 * Notes on filtering:
 * - We map filters to native WP REST params (`status`, `author`) rather
 *   than to our derived `kind` so server-side queries stay simple. The
 *   Status column still renders the derived `kind` (sent/scheduled/draft/
 *   trash) for visual clarity — see `renderStatus` in `fields.js`.
 * - `status=any` excludes trash by default, so we explicitly include the
 *   common writable statuses when no status filter is set.
 */

import { buildQueryParams as baseBuildQueryParams, toQueryString } from '../../utils/build-query';

// `auto-draft` so an abandoned "Add new" still shows in the list.
const DEFAULT_STATUSES = 'publish,private,future,draft,pending,auto-draft';

// `status` is handled separately by the shared util's status-filter branch, not here.
const FIELD_TO_QUERY_PARAM = {
	author: 'author',
	categories: 'categories',
	tags: 'tags',
	// `Newsletters_List_REST::filter_send_list_query` consumes this.
	send_list: 'newspack_newsletters_send_list_id',
	// `public_page` filter values are `'1'` / `'0'` (see `getFields`).
	// `Newsletters_List_REST::filter_rest_query` consumes the same param.
	public_page: 'newspack_newsletters_is_public',
};

const SORT_FIELD_TO_ORDERBY = {
	title: 'title',
	date: 'date',
	send_date: 'date',
	author: 'author',
};

export function buildQueryParams( view = {} ) {
	return baseBuildQueryParams( view, {
		fieldToQueryParam: FIELD_TO_QUERY_PARAM,
		sortFieldToOrderby: SORT_FIELD_TO_ORDERBY,
		defaultStatuses: DEFAULT_STATUSES,
		extraParams: { _embed: 'author,wp:term' },
	} );
}

export { toQueryString };

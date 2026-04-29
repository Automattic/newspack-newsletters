/**
 * URL-driven initial filters for the Newsletters list DataView.
 *
 * `Admin_Shell::maybe_redirect_legacy_list` forwards a `post_status`
 * query arg from the legacy `edit.php?post_type=newspack_nl_cpt` URL
 * onto the React page (e.g. a deep link to the trashed view). Map that
 * raw status into the `status` filter element values the DataView uses.
 *
 * Pure module so it stays trivial to unit-test.
 */

const POST_STATUS_TO_FILTER_VALUE = {
	trash: 'trash',
	draft: 'draft',
	future: 'future',
	publish: 'publish,private',
	private: 'publish,private',
};

/**
 * Read the current document URL and return DataViews-compatible
 * filters seeded from `post_status`. Returns `[]` when no recognised
 * value is present.
 *
 * @param {string} [search] URL search string (defaults to `window.location.search`).
 * @return {Array<{ field: string, operator: string, value: Array<string> }>} DataViews-shaped initial filters.
 */
export function getInitialFilters( search = typeof window === 'undefined' ? '' : window.location.search ) {
	const params = new URLSearchParams( search );
	const postStatus = params.get( 'post_status' );
	if ( ! postStatus ) {
		return [];
	}

	const value = POST_STATUS_TO_FILTER_VALUE[ postStatus ];
	if ( ! value ) {
		return [];
	}

	return [ { field: 'status', operator: 'isAny', value: [ value ] } ];
}

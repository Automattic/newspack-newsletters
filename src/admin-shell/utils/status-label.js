/**
 * Shared status-label factory for DataView list screens.
 *
 * Each screen registers a `newspack_newsletters_*_status` REST field whose
 * `kind` enum maps to a translated label. The factory captures the lazy-
 * memoised lookup so the per-row `getValue`/`render` paths can call
 * `statusKindLabel( kind )` without re-allocating the labels map or
 * re-running `__()` for every row.
 */

/**
 * Build a `{ STATUS_KIND_LABELS, statusKindLabel }` pair for a screen.
 *
 * `buildLabels` is invoked lazily on first call so i18n data has had a
 * chance to register before any `__()` lookups run.
 *
 * @param {() => Object} buildLabels Factory returning the `{kind: label}` map.
 * @return {{ STATUS_KIND_LABELS: () => Object, statusKindLabel: ( kind: string ) => string }} Memoised accessors.
 */
export function createStatusLabelModule( buildLabels ) {
	let cached = null;

	const STATUS_KIND_LABELS = () => {
		if ( null === cached ) {
			cached = buildLabels();
		}
		return cached;
	};

	const statusKindLabel = kind => {
		const labels = STATUS_KIND_LABELS();
		return labels[ kind ] || labels.draft;
	};

	return { STATUS_KIND_LABELS, statusKindLabel };
}

/**
 * Returns true if a row item is currently in the trash. DataView actions
 * read this to gate destructive vs restorative buttons.
 *
 * @param {Object} item Post object from REST.
 * @return {boolean} True when the row is trashed.
 */
export function isTrashed( item ) {
	return 'trash' === item?.status;
}

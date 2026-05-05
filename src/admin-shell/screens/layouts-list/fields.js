/**
 * Field definitions for the Layouts list DataView.
 *
 * Three fields drive the surface:
 *
 * - **title** — primary; doubles as inline rename. When the screen's
 *   `renamingId` matches the row id the field renders a `<TextControl>`
 *   that PATCHes the post title on blur (or Enter), mirroring the
 *   ergonomic of `SingleLayoutPreview` in the existing layout picker.
 * - **preview** — `mediaField` for the grid layout; renders a live
 *   `<NewsletterPreview>` of the parsed blocks, deferred via
 *   `LazyPreview` so off-screen cards don't mount their iframes until
 *   the user scrolls them in.
 * - **modified** — last-edited date as a sortable column. Useful in
 *   table layout for spotting stale layouts.
 *
 * The CPT collection accepts `orderby` ∈ { date, modified, title }.
 * `enableSorting` is opt-in here — title and modified are useful sorts.
 */

import { parse } from '@wordpress/blocks';
import { Icon, TextControl } from '@wordpress/components';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { dateI18n, getDate, getSettings } from '@wordpress/date';
import { __ } from '@wordpress/i18n';
import { commentAuthorAvatar, lock, plugins } from '@wordpress/icons';
import { ENTER, ESCAPE } from '@wordpress/keycodes';

import NewsletterPreview from '../../../components/newsletter-preview';
import { setPreventDeduplicationForPostsInserter } from '../../../editor/blocks/posts-inserter/utils';
import LazyPreview from './lazy-preview';

// Sentinel used in author-filter values + getValue for prebuilt rows.
// Real WP user IDs are positive integers, so a string token can't
// collide with them.
export const PREBUILT_AUTHOR_VALUE = 'newspack';

function getRawTitle( item ) {
	// REST `context=edit` returns title as `{ raw, rendered }`.
	return item?.title?.raw ?? item?.title?.rendered ?? '';
}

function getRawContent( item ) {
	return item?.content?.raw ?? '';
}

function getMetaForPreview( item ) {
	const meta = item?.meta || {};
	return {
		font_body: meta.font_body || '',
		font_header: meta.font_header || '',
		background_color: meta.background_color || '',
		text_color: meta.text_color || '',
		custom_css: meta.custom_css || '',
	};
}

/**
 * Inline-renaming title cell.
 *
 * Swaps to a `<TextControl>` when the row is the renaming target. The
 * control auto-focuses, commits on blur or Enter, and reverts on
 * Escape — matching the picker's behaviour. `stopPropagation` on the
 * outer wrapper prevents the DataView's row-click handler from also
 * toggling the row's selection state while the user types.
 */
function RenamingTitle( { item, onCommit, onCancel } ) {
	const [ value, setValue ] = useState( getRawTitle( item ) );
	const [ isBusy, setIsBusy ] = useState( false );
	const inputRef = useRef( null );

	// Auto-focus once on mount. The TextControl renders an internal
	// `<input>`; querying through the wrapping div lets us focus it
	// without depending on a forwarded-ref API.
	useEffect( () => {
		const input = inputRef.current?.querySelector?.( 'input' );
		input?.focus();
		input?.select();
	}, [] );

	const commit = async () => {
		const trimmed = ( value || '' ).trim();
		const original = getRawTitle( item );
		if ( trimmed === '' || trimmed === original ) {
			onCancel();
			return;
		}
		setIsBusy( true );
		try {
			await onCommit( trimmed );
		} catch {
			// The screen-level handler raises an error notice and
			// leaves `renamingId` set so the inline UI stays available
			// for retry. Swallow here so `onBlur` / `onKeyDown` don't
			// emit an unhandled rejection.
		} finally {
			setIsBusy( false );
		}
	};

	const onKeyDown = event => {
		if ( event.keyCode === ENTER ) {
			event.preventDefault();
			commit();
		} else if ( event.keyCode === ESCAPE ) {
			event.preventDefault();
			onCancel();
		}
	};

	// `onClickCapture` rather than `onClick` so the wrapper isn't flagged
	// by `jsx-a11y/no-static-element-interactions` (which only checks the
	// classic interactive event names). The capture-phase handler stops
	// the click from bubbling up to the DataView row, which would
	// otherwise toggle the row's selection while the user types.
	return (
		<div ref={ inputRef } onClickCapture={ event => event.stopPropagation() }>
			<TextControl
				value={ value }
				onChange={ setValue }
				onBlur={ commit }
				onKeyDown={ onKeyDown }
				disabled={ isBusy }
				__nextHasNoMarginBottom
			/>
		</div>
	);
}

/**
 * Build the field list.
 *
 * @param {Object}             options
 * @param {string|number|null} options.renamingId     Row id currently in inline-rename mode (or `null`).
 * @param {Function}           options.onRenameCommit `(item, newTitle) => Promise` — PATCH and refresh.
 * @param {Function}           options.onRenameCancel `() => void` — clear `renamingId` without saving.
 * @param {Array}              options.authorElements Filter elements for the author field, derived from the loaded data.
 * @return {Array} Field definitions.
 */
export function getFields( { renamingId = null, onRenameCommit, onRenameCancel, authorElements = [] } = {} ) {
	const renderTitle = ( { item } ) => {
		const id = item?.id;
		if ( renamingId !== null && String( renamingId ) === String( id ) ) {
			return <RenamingTitle item={ item } onCommit={ next => onRenameCommit?.( item, next ) } onCancel={ () => onRenameCancel?.() } />;
		}
		const label = getRawTitle( item ) || __( '(no title)', 'newspack-newsletters' );
		// Prebuilts get a lock affordance to the right of the title —
		// matches the WordPress Patterns surface where bundled patterns
		// signal their read-only state with the same icon.
		if ( item?.is_prebuilt ) {
			return (
				<span className="newspack-newsletters-layouts-list__title">
					<strong>{ label }</strong>
					<Icon
						className="newspack-newsletters-layouts-list__lock-icon"
						icon={ lock }
						size={ 16 }
						aria-label={ __( 'Locked: bundled with the plugin', 'newspack-newsletters' ) }
					/>
				</span>
			);
		}
		return <strong>{ label }</strong>;
	};

	const renderAuthor = ( { item } ) => {
		const author = item?._embedded?.author?.[ 0 ];
		if ( ! author ) {
			return null;
		}
		const isPrebuilt = !! item?.is_prebuilt;
		const icon = isPrebuilt ? plugins : commentAuthorAvatar;
		return (
			<span className="newspack-newsletters-layouts-list__author">
				<Icon className="newspack-newsletters-layouts-list__author-icon" icon={ icon } size={ 24 } />
				<span>{ author.name || '' }</span>
			</span>
		);
	};

	const authorField = {
		id: 'author',
		label: __( 'Author', 'newspack-newsletters' ),
		enableSorting: false,
		// No primary filter chip — matches the Templates surface, which
		// renders no always-on filter. Users who want to filter by
		// author open the Filters menu explicitly.
		getValue: ( { item } ) => ( item?.is_prebuilt ? PREBUILT_AUTHOR_VALUE : String( item?._embedded?.author?.[ 0 ]?.id ?? item?.author ?? '' ) ),
		render: renderAuthor,
	};

	if ( authorElements.length > 0 ) {
		authorField.elements = authorElements;
		authorField.filterBy = { operators: [ 'is', 'isAny', 'isNone' ] };
	}

	return [
		{
			id: 'title',
			label: __( 'Title', 'newspack-newsletters' ),
			enableGlobalSearch: true,
			enableSorting: true,
			getValue: ( { item } ) => getRawTitle( item ),
			render: renderTitle,
		},
		authorField,
		{
			id: 'preview',
			label: __( 'Preview', 'newspack-newsletters' ),
			enableSorting: false,
			enableHiding: false,
			getValue: () => '',
			render: PreviewCard,
		},
		{
			id: 'modified',
			label: __( 'Last modified', 'newspack-newsletters' ),
			enableSorting: true,
			getValue: ( { item } ) => item?.modified || '',
			render: ( { item } ) => {
				const value = item?.modified;
				if ( ! value ) {
					return null;
				}
				// REST `modified` is a site-local string with no offset.
				// `getDate` re-anchors it to `wp.date.settings.timezone` so
				// admins outside the site timezone don't see the wrong
				// calendar date — same pattern the newsletters list uses.
				const settings = getSettings();
				return <span>{ dateI18n( settings.formats.date, getDate( value ) ) }</span>;
			},
		},
	];
}

/**
 * Grid card preview. Memoises the parsed-block tree so resize /
 * unrelated rerenders don't re-parse the layout markup, and wraps the
 * `<NewsletterPreview>` in `LazyPreview` so the iframe only mounts when
 * the card scrolls into view.
 */
function PreviewCard( { item } ) {
	const content = getRawContent( item );
	const meta = getMetaForPreview( item );
	const blocks = useMemo( () => {
		if ( ! content ) {
			return [];
		}
		// Match the layout picker's behaviour — posts-inserter blocks
		// inside a layout would otherwise dedupe against the editor's
		// post list when previewed. The picker uses the same helper for
		// the same reason; the Layouts list inherits the consequence.
		return setPreventDeduplicationForPostsInserter( parse( content ) );
	}, [ content ] );

	if ( ! content || ! blocks.length ) {
		// `role="img"` plus a visually-hidden label so screen readers
		// announce the empty state — generic divs with only `aria-label`
		// aren't reliably announced.
		const emptyLabel = __( 'Empty layout', 'newspack-newsletters' );
		return (
			<div
				role="img"
				aria-label={ emptyLabel }
				className="newspack-newsletters-layouts-list__preview newspack-newsletters-layouts-list__preview--empty"
			>
				<span className="screen-reader-text">{ emptyLabel }</span>
			</div>
		);
	}

	return (
		<LazyPreview placeholderStyle={ { aspectRatio: '1' } } rootMargin="200px">
			{ () => (
				<div className="newspack-newsletters-layouts-list__preview">
					<NewsletterPreview layoutId={ item?.id } meta={ meta } blocks={ blocks } viewportWidth={ 848 } />
				</div>
			) }
		</LazyPreview>
	);
}

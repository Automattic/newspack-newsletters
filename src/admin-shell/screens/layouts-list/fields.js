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
import { TextControl } from '@wordpress/components';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { dateI18n, getSettings } from '@wordpress/date';
import { __ } from '@wordpress/i18n';
import { ENTER, ESCAPE } from '@wordpress/keycodes';

import NewsletterPreview from '../../../components/newsletter-preview';
import { setPreventDeduplicationForPostsInserter } from '../../../editor/blocks/posts-inserter/utils';
import LazyPreview from './lazy-preview';

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
 * @return {Array} Field definitions.
 */
export function getFields( { renamingId = null, onRenameCommit, onRenameCancel } = {} ) {
	const renderTitle = ( { item } ) => {
		const id = item?.id;
		if ( renamingId !== null && String( renamingId ) === String( id ) ) {
			return <RenamingTitle item={ item } onCommit={ next => onRenameCommit?.( item, next ) } onCancel={ () => onRenameCancel?.() } />;
		}
		const label = getRawTitle( item ) || __( '(no title)', 'newspack-newsletters' );
		return <strong>{ label }</strong>;
	};

	return [
		{
			id: 'title',
			label: __( 'Title', 'newspack-newsletters' ),
			enableGlobalSearch: true,
			enableSorting: true,
			getValue: ( { item } ) => getRawTitle( item ),
			render: renderTitle,
		},
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
				const settings = getSettings();
				return <span>{ dateI18n( settings.formats.date, value ) }</span>;
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
		return (
			<div
				aria-label={ __( 'Empty layout', 'newspack-newsletters' ) }
				className="newspack-newsletters-layouts-list__preview newspack-newsletters-layouts-list__preview--empty"
			/>
		);
	}

	return (
		<LazyPreview placeholderStyle={ { minHeight: '320px' } } rootMargin="200px">
			{ () => (
				<div className="newspack-newsletters-layouts-list__preview">
					<NewsletterPreview layoutId={ item?.id } meta={ meta } blocks={ blocks } viewportWidth={ 848 } />
				</div>
			) }
		</LazyPreview>
	);
}

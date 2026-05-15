/**
 * WordPress dependencies
 */
import { BlockControls } from '@wordpress/block-editor';
import { Button, Popover, SearchControl, ToolbarButton } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { insert, registerFormatType, remove, useAnchor } from '@wordpress/rich-text';
import { mergeTags } from 'newspack-icons';

/**
 * Internal dependencies
 */
import { TRIGGER, getLabel, getLegacyTrigger, useMergeTagItems } from './utils';

const FORMAT_NAME = 'newspack-newsletters/merge-tag';
// className disambiguates from core/underline (which already claims bare `<span>`) even though the format is never applied.
const FORMAT_SETTINGS = {
	tagName: 'span',
	className: 'newspack-newsletters-merge-tag-noop',
};

const CaretAnchoredPicker = ( { contentRef, value, onSelect, onClose } ) => {
	const anchor = useAnchor( {
		editableContentElement: contentRef?.current,
		value,
		settings: FORMAT_SETTINGS,
	} );
	return <MergeTagPicker anchor={ anchor } onSelect={ onSelect } onClose={ onClose } />;
};

const MergeTagPicker = ( { anchor, onSelect, onClose } ) => {
	const [ search, setSearch ] = useState( '' );
	const items = useMergeTagItems( search );
	const searchLabel = sprintf(
		/* translators: %s: ESP-native singular noun (e.g. "merge tag" or "personalization tag"). */
		__( 'Search %s', 'newspack-newsletters' ),
		getLabel()
	);

	return (
		<Popover
			anchor={ anchor }
			className="newspack-newsletters-merge-tags-picker__popover"
			placement="bottom-start"
			offset={ 13 }
			focusOnMount="firstElement"
			onClose={ onClose }
			onFocusOutside={ onClose }
		>
			<div className="newspack-newsletters-merge-tags-picker">
				<SearchControl __nextHasNoMarginBottom value={ search } onChange={ setSearch } label={ searchLabel } placeholder={ searchLabel } />
				{ items.length === 0 ? (
					<p className="newspack-newsletters-merge-tags-picker__empty">{ __( 'No matches.', 'newspack-newsletters' ) }</p>
				) : (
					<ul className="newspack-newsletters-merge-tags-picker__list">
						{ items.map( item => (
							<li key={ item.key }>
								<Button className="newspack-newsletters-merge-tags-picker__option" onClick={ () => onSelect( item.value.tag ) }>
									{ item.label }
								</Button>
							</li>
						) ) }
					</ul>
				) }
			</div>
		</Popover>
	);
};

const MergeTagEdit = ( { value, onChange, contentRef } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const [ anchorMode, setAnchorMode ] = useState( 'caret' );
	const [ buttonRef, setButtonRef ] = useState();
	// Snapshot the value so the caret survives the popover stealing focus.
	const valueRef = useRef( value );
	const prevTextLengthRef = useRef( value.text.length );

	useEffect( () => {
		const { text, start } = value;
		// Only fire on single-character growth so paste operations don't hijack the picker.
		const typedOne = text.length === prevTextLengthRef.current + 1;
		prevTextLengthRef.current = text.length;
		if ( ! typedOne ) {
			return;
		}
		const legacy = getLegacyTrigger();
		const triggers = legacy ? [ TRIGGER, legacy ] : [ TRIGGER ];
		const matched = triggers.find( t => start >= t.length && text.slice( start - t.length, start ) === t );
		if ( matched ) {
			const stripped = remove( value, start - matched.length, start );
			valueRef.current = stripped;
			onChange( stripped );
			setAnchorMode( 'caret' );
			setOpen( true );
		}
	}, [ value, onChange ] );

	const toggleFromToolbar = () => {
		if ( isOpen ) {
			setOpen( false );
			return;
		}
		valueRef.current = value;
		setAnchorMode( 'toolbar' );
		setOpen( true );
	};

	// Keep popover focus when clicking the open button so onFocusOutside doesn't pre-close it before the toggle handler fires.
	const onToolbarMouseDown = event => {
		if ( isOpen ) {
			event.preventDefault();
		}
	};

	const handleSelect = tag => {
		setOpen( false );
		onChange( insert( valueRef.current, tag ) );
	};

	const label = sprintf(
		/* translators: %s: ESP-native singular noun (e.g. "merge tag" or "personalization tag"). */
		__( 'Insert %s', 'newspack-newsletters' ),
		getLabel()
	);

	const closePicker = () => setOpen( false );

	return (
		<>
			<BlockControls group="inline">
				<ToolbarButton
					ref={ setButtonRef }
					icon={ mergeTags }
					label={ label }
					onMouseDown={ onToolbarMouseDown }
					onClick={ toggleFromToolbar }
				/>
			</BlockControls>
			{ isOpen && anchorMode === 'toolbar' && <MergeTagPicker anchor={ buttonRef } onSelect={ handleSelect } onClose={ closePicker } /> }
			{ isOpen && anchorMode === 'caret' && (
				<CaretAnchoredPicker contentRef={ contentRef } value={ value } onSelect={ handleSelect } onClose={ closePicker } />
			) }
		</>
	);
};

export default () => {
	registerFormatType( FORMAT_NAME, {
		title: sprintf(
			/* translators: %s: ESP-native singular noun (e.g. "merge tag" or "personalization tag"). */
			__( 'Insert %s', 'newspack-newsletters' ),
			getLabel()
		),
		edit: MergeTagEdit,
		...FORMAT_SETTINGS,
	} );
};

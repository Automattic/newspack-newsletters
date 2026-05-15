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
const FORMAT_SETTINGS = {
	tagName: 'span',
	className: 'newspack-newsletters-merge-tag-noop',
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
			offset={ 16 }
			focusOnMount="firstElement"
			onClose={ onClose }
			onFocusOutside={ onClose }
		>
			<div className="newspack-newsletters-merge-tags-picker">
				<SearchControl __nextHasNoMarginBottom value={ search } onChange={ setSearch } label={ searchLabel } placeholder={ searchLabel } />
				{ items.length === 0 ? (
					<p className="newspack-newsletters-merge-tags-picker__empty">{ __( 'No matches.', 'newspack-newsletters' ) }</p>
				) : (
					<ul className="newspack-newsletters-merge-tags-picker__list" role="listbox">
						{ items.map( item => (
							<li key={ item.key } role="option" aria-selected="false">
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

	const caretAnchor = useAnchor( {
		editableContentElement: contentRef?.current,
		value,
		settings: FORMAT_SETTINGS,
	} );

	useEffect( () => {
		const { text, start } = value;
		const grew = text.length > prevTextLengthRef.current;
		prevTextLengthRef.current = text.length;
		if ( ! grew ) {
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

	const openFromToolbar = () => {
		valueRef.current = value;
		setAnchorMode( 'toolbar' );
		setOpen( true );
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

	const anchor = anchorMode === 'toolbar' ? buttonRef : caretAnchor;

	return (
		<>
			<BlockControls group="inline">
				<ToolbarButton ref={ setButtonRef } icon={ mergeTags } label={ label } onClick={ openFromToolbar } isActive={ isOpen } />
			</BlockControls>
			{ isOpen && <MergeTagPicker anchor={ anchor } onSelect={ handleSelect } onClose={ () => setOpen( false ) } /> }
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
		// Required by registerFormatType but never applied — `edit` is used only to render the toolbar fill.
		...FORMAT_SETTINGS,
		edit: MergeTagEdit,
	} );
};

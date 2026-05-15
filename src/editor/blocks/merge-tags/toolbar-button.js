/**
 * WordPress dependencies
 */
import { BlockControls } from '@wordpress/block-editor';
import { Button, Popover, SearchControl, ToolbarButton } from '@wordpress/components';
import { useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { insert, registerFormatType } from '@wordpress/rich-text';
import { mergeTags } from 'newspack-icons';

/**
 * Internal dependencies
 */
import { getLabel, useMergeTagItems } from './utils';

const FORMAT_NAME = 'newspack-newsletters/merge-tag';

const MergeTagPicker = ( { anchor, onSelect, onClose } ) => {
	const [ search, setSearch ] = useState( '' );
	const [ items ] = useMergeTagItems( search );
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

const MergeTagEdit = ( { value, onChange } ) => {
	const [ isOpen, setOpen ] = useState( false );
	const [ buttonRef, setButtonRef ] = useState();
	// Snapshot the value so the caret survives the popover stealing focus.
	const valueRef = useRef( value );

	const openPicker = () => {
		valueRef.current = value;
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

	return (
		<>
			<BlockControls group="inline">
				<ToolbarButton ref={ setButtonRef } icon={ mergeTags } label={ label } onClick={ openPicker } isActive={ isOpen } />
			</BlockControls>
			{ isOpen && <MergeTagPicker anchor={ buttonRef } onSelect={ handleSelect } onClose={ () => setOpen( false ) } /> }
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
		tagName: 'span',
		className: 'newspack-newsletters-merge-tag-noop',
		edit: MergeTagEdit,
	} );
};

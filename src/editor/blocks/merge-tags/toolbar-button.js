/**
 * WordPress dependencies
 */
import { RichTextToolbarButton } from '@wordpress/block-editor';
import { Button, Popover, SearchControl } from '@wordpress/components';
import { useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { insert, registerFormatType } from '@wordpress/rich-text';
import { mergeTags } from 'newspack-icons';

/**
 * Internal dependencies
 */
import { getLabel, useMergeTagItems } from './utils';

const FORMAT_NAME = 'newspack-newsletters/merge-tag';

const MergeTagPicker = ( { onSelect, onClose } ) => {
	const [ search, setSearch ] = useState( '' );
	const [ items ] = useMergeTagItems( search );

	return (
		<Popover
			className="newspack-newsletters-merge-tags-picker__popover"
			placement="bottom-start"
			focusOnMount="firstElement"
			onClose={ onClose }
			onFocusOutside={ onClose }
		>
			<div className="newspack-newsletters-merge-tags-picker">
				<SearchControl
					__nextHasNoMarginBottom
					value={ search }
					onChange={ setSearch }
					label={ sprintf(
						/* translators: %s: ESP-native singular noun (e.g. "merge tag" or "personalization tag"). */
						__( 'Search %s', 'newspack-newsletters' ),
						getLabel()
					) }
					placeholder={ sprintf(
						/* translators: %s: ESP-native singular noun (e.g. "merge tag" or "personalization tag"). */
						__( 'Search %s', 'newspack-newsletters' ),
						getLabel()
					) }
				/>
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

const MergeTagEdit = ( { value, onChange, isActive } ) => {
	const [ isOpen, setOpen ] = useState( false );
	// Snapshot the RichTextValue at click-time so the selection survives popover focus stealing it from the editor.
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
			<RichTextToolbarButton icon={ mergeTags } title={ label } onClick={ openPicker } isActive={ isActive || isOpen } />
			{ isOpen && <MergeTagPicker onSelect={ handleSelect } onClose={ () => setOpen( false ) } /> }
		</>
	);
};

export default () => {
	registerFormatType( FORMAT_NAME, {
		// `tagName`/`className` are required by registerFormatType but never applied — we use the format slot purely to inject a toolbar button via `edit`.
		title: sprintf(
			/* translators: %s: ESP-native singular noun (e.g. "merge tag" or "personalization tag"). */
			__( 'Insert %s', 'newspack-newsletters' ),
			getLabel()
		),
		tagName: 'span',
		className: 'newspack-newsletters-merge-tag-noop',
		edit: MergeTagEdit,
	} );
};

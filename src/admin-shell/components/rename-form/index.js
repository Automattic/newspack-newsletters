/**
 * Inline rename form for DataView row actions.
 *
 * Designed to be rendered inside an action's `RenderModal` — DataViews
 * supplies the surrounding `<Modal>` (medium size, title, focus trap),
 * so this component is just the form body: a TextControl plus a
 * Cancel / Save footer.
 */

import apiFetch from '@wordpress/api-fetch';
import {
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	Button,
	TextControl,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { notifyError, notifySuccess } from '../../notices';

const titleOf = item => item?.title?.raw ?? item?.title?.rendered ?? '';

export default function RenameForm( { item, postPath, savedMessage, closeModal, onSaved } ) {
	const initialTitle = titleOf( item );
	const [ name, setName ] = useState( initialTitle );
	const [ isBusy, setIsBusy ] = useState( false );

	const trimmed = name.trim();
	const canSave = trimmed.length > 0 && trimmed !== initialTitle;

	const handleSubmit = async event => {
		event.preventDefault();
		if ( ! canSave || isBusy ) {
			return;
		}
		setIsBusy( true );
		try {
			await apiFetch( {
				path: `${ postPath }/${ item.id }`,
				method: 'POST',
				data: { title: trimmed },
			} );
			notifySuccess( savedMessage || __( 'Renamed.', 'newspack-newsletters' ) );
			onSaved();
			closeModal();
		} catch ( error ) {
			setIsBusy( false );
			notifyError( error?.message || __( 'Could not rename. Please try again.', 'newspack-newsletters' ) );
		}
	};

	return (
		<form onSubmit={ handleSubmit }>
			<VStack spacing={ 4 }>
				<TextControl
					label={ __( 'Name', 'newspack-newsletters' ) }
					value={ name }
					onChange={ setName }
					__nextHasNoMarginBottom
					__next40pxDefaultSize
				/>
				<HStack justify="flex-end" spacing={ 2 }>
					<Button variant="tertiary" onClick={ closeModal } disabled={ isBusy }>
						{ __( 'Cancel', 'newspack-newsletters' ) }
					</Button>
					<Button variant="primary" type="submit" isBusy={ isBusy } disabled={ isBusy || ! canSave }>
						{ __( 'Save', 'newspack-newsletters' ) }
					</Button>
				</HStack>
			</VStack>
		</form>
	);
}

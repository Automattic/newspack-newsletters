import apiFetch from '@wordpress/api-fetch';
import {
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	Button,
	Modal,
	Notice,
	TextControl,
	TextareaControl,
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const CREATE_PATH = '/newspack-newsletters/v1/lists/local';

export default function LocalListModal( { onClose, onSaved } ) {
	const [ title, setTitle ] = useState( '' );
	const [ description, setDescription ] = useState( '' );
	const [ isBusy, setIsBusy ] = useState( false );
	const [ error, setError ] = useState( '' );

	const submit = async event => {
		event.preventDefault();

		const trimmedTitle = title.trim();
		if ( ! trimmedTitle ) {
			setError( __( 'List title is required.', 'newspack-newsletters' ) );
			return;
		}

		setIsBusy( true );
		setError( '' );

		try {
			await apiFetch( {
				path: CREATE_PATH,
				method: 'POST',
				data: {
					title: trimmedTitle,
					description,
				},
			} );
			onSaved();
			onClose();
		} catch ( err ) {
			setError( err?.message || __( 'Could not create local list. Please try again.', 'newspack-newsletters' ) );
			setIsBusy( false );
		}
	};

	return (
		<Modal
			title={ __( 'Add new local list', 'newspack-newsletters' ) }
			onRequestClose={ onClose }
			size="medium"
			className="newspack-newsletters-local-list-modal"
		>
			<form onSubmit={ submit }>
				<VStack spacing={ 4 }>
					{ error && (
						<Notice status="error" isDismissible={ false }>
							{ error }
						</Notice>
					) }
					<TextControl
						label={ __( 'List title', 'newspack-newsletters' ) }
						value={ title }
						onChange={ setTitle }
						required
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
					<TextareaControl
						label={ __( 'List description', 'newspack-newsletters' ) }
						help={ __( 'Optional description for this list.', 'newspack-newsletters' ) }
						value={ description }
						onChange={ setDescription }
						__nextHasNoMarginBottom
					/>
					<HStack justify="flex-end" spacing={ 2 }>
						<Button variant="tertiary" onClick={ onClose } disabled={ isBusy }>
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
						<Button variant="primary" type="submit" isBusy={ isBusy } disabled={ isBusy }>
							{ __( 'Add list', 'newspack-newsletters' ) }
						</Button>
					</HStack>
				</VStack>
			</form>
		</Modal>
	);
}

import apiFetch from '@wordpress/api-fetch';
import {
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	Button,
	Modal,
	Notice,
	SelectControl,
	TextControl,
	TextareaControl,
} from '@wordpress/components';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const CREATE_PATH = '/newspack-newsletters/v1/lists/local';
const AUDIENCES_PATH = '/newspack-newsletters/v1/lists/audiences';

export default function LocalListModal( { list = null, onClose, onSaved } ) {
	const isEdit = Boolean( list?.db_id );

	const [ title, setTitle ] = useState( list?.title || '' );
	const [ description, setDescription ] = useState( list?.description || '' );
	const [ audience, setAudience ] = useState( list?.audience || '' );
	const [ audiences, setAudiences ] = useState( [] );
	const [ audienceLabel, setAudienceLabel ] = useState( __( 'List', 'newspack-newsletters' ) );
	const [ audienceHelp, setAudienceHelp ] = useState( '' );
	const [ audiencesLoaded, setAudiencesLoaded ] = useState( false );
	const [ isBusy, setIsBusy ] = useState( false );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		let cancelled = false;
		apiFetch( { path: AUDIENCES_PATH } )
			.then( payload => {
				if ( cancelled ) {
					return;
				}
				setAudiences( Array.isArray( payload?.audiences ) ? payload.audiences : [] );
				if ( payload?.audience_label ) {
					setAudienceLabel( payload.audience_label );
				}
				if ( payload?.help_before_save ) {
					setAudienceHelp( payload.help_before_save );
				}
			} )
			.catch( () => {
				/* leave audiences empty — modal still works without the picker */
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setAudiencesLoaded( true );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [] );

	const audienceOptions = useMemo( () => {
		const options = audiences.map( a => ( { label: a.name, value: a.id } ) );
		// Empty audience means "leave wiring untouched" server-side, so only offer it when there's no wiring to leave.
		if ( ! list?.audience ) {
			return [ { label: __( 'Configure later', 'newspack-newsletters' ), value: '' }, ...options ];
		}
		return options;
	}, [ audiences, list?.audience ] );

	const submit = async event => {
		event.preventDefault();

		const trimmedTitle = title.trim();
		if ( ! trimmedTitle ) {
			setError( __( 'List title is required.', 'newspack-newsletters' ) );
			return;
		}

		setIsBusy( true );
		setError( '' );

		const path = isEdit ? `${ CREATE_PATH }/${ list.db_id }` : CREATE_PATH;
		const method = isEdit ? 'PATCH' : 'POST';
		const data = {
			title: trimmedTitle,
			description,
			audience,
		};

		try {
			const saved = await apiFetch( { path, method, data } );
			onSaved( { list: saved, mode: isEdit ? 'edit' : 'add' } );
			onClose();
		} catch ( err ) {
			const fallback = isEdit
				? __( 'Could not update local list. Please try again.', 'newspack-newsletters' )
				: __( 'Could not create local list. Please try again.', 'newspack-newsletters' );
			setError( err?.message || fallback );
			setIsBusy( false );
		}
	};

	return (
		<Modal
			title={ isEdit ? __( 'Edit local list', 'newspack-newsletters' ) : __( 'Add new local list', 'newspack-newsletters' ) }
			onRequestClose={ isBusy ? () => {} : onClose }
			shouldCloseOnEsc={ ! isBusy }
			shouldCloseOnClickOutside={ ! isBusy }
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
					{ audiencesLoaded && audiences.length > 0 && (
						<SelectControl
							label={ audienceLabel }
							value={ audience }
							options={ audienceOptions }
							onChange={ setAudience }
							help={ audienceHelp }
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
					) }
					<HStack justify="flex-end" spacing={ 2 }>
						<Button variant="tertiary" onClick={ onClose } disabled={ isBusy }>
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
						<Button variant="primary" type="submit" isBusy={ isBusy } disabled={ isBusy }>
							{ isEdit ? __( 'Save changes', 'newspack-newsletters' ) : __( 'Add list', 'newspack-newsletters' ) }
						</Button>
					</HStack>
				</VStack>
			</form>
		</Modal>
	);
}

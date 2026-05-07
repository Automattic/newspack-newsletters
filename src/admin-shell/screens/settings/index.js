import {
	Notice,
	Spinner,
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
} from '@wordpress/components';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { dispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import ListsSection from './lists-section';
import OptionsSection from './options-section';
import ProviderSection from './provider-section';
import useListsData from './use-lists-data';
import useSettingsData from './use-settings-data';

const LETTERHEAD_KEY = 'newspack_newsletters_letterhead_api_key';

export default function SettingsScreen() {
	const { data, isLoading, error, save: saveSettings, reload: reloadSettings } = useSettingsData();
	const { lists, isLoading: isListsLoading, error: listsError, patchList, reload: reloadLists } = useListsData();

	const savedSlug = data?.provider?.selected || '';

	const [ pendingSlug, setPendingSlug ] = useState( savedSlug );
	const [ pendingCredentials, setPendingCredentials ] = useState( {} );
	const [ pendingOptions, setPendingOptions ] = useState( {} );
	const [ isSaving, setIsSaving ] = useState( false );

	// Resync pending state whenever fresh data lands (post-save reload, OAuth
	// authorise, manual refresh).
	useEffect( () => {
		setPendingSlug( savedSlug );
		setPendingCredentials( {} );
	}, [ savedSlug ] );

	useEffect( () => {
		setPendingOptions( {} );
	}, [ data?.options ] );

	const handleAuthorized = useCallback( () => {
		reloadSettings();
		reloadLists();
	}, [ reloadSettings, reloadLists ] );

	const updateOption = useCallback( ( key, value ) => {
		setPendingOptions( current => ( { ...current, [ key ]: value } ) );
	}, [] );

	const updateCredential = useCallback( ( key, value ) => {
		setPendingCredentials( current => ( { ...current, [ key ]: value } ) );
	}, [] );

	const onSlugChange = useCallback( next => {
		setPendingSlug( next );
		setPendingCredentials( {} );
	}, [] );

	const slugDirty = pendingSlug !== savedSlug;
	const credentialsDirty = Object.keys( pendingCredentials ).length > 0;
	const optionsDirty = Object.keys( pendingOptions ).length > 0;
	const isDirty = slugDirty || credentialsDirty || optionsDirty;

	const handleSave = useCallback( async () => {
		const payload = {};
		if ( slugDirty || credentialsDirty ) {
			payload.provider = { slug: pendingSlug };
			if ( pendingSlug !== 'manual' && credentialsDirty ) {
				const submitted = {};
				Object.keys( pendingCredentials ).forEach( key => {
					const value = pendingCredentials[ key ];
					if ( typeof value === 'string' && value.length > 0 ) {
						submitted[ key ] = value;
					}
				} );
				payload.provider.credentials = submitted;
			}
		}
		if ( optionsDirty ) {
			payload.options = { ...pendingOptions };
		}
		if ( Object.keys( payload ).length === 0 ) {
			return;
		}
		setIsSaving( true );
		try {
			await saveSettings( payload );
			dispatch( noticesStore ).createSuccessNotice( __( 'Settings saved.', 'newspack-newsletters' ), { type: 'snackbar' } );
			if ( payload.provider ) {
				reloadLists();
			}
		} catch ( err ) {
			const message = err?.message || __( 'Could not save settings. Check the credentials and try again.', 'newspack-newsletters' );
			dispatch( noticesStore ).createErrorNotice( message, { type: 'snackbar', explicitDismiss: true } );
		} finally {
			setIsSaving( false );
		}
	}, [ slugDirty, credentialsDirty, optionsDirty, pendingSlug, pendingCredentials, pendingOptions, saveSettings, reloadLists ] );

	if ( isLoading && ! data ) {
		return (
			<HStack className="newspack-newsletters-admin__loading" justify="center">
				<Spinner />
			</HStack>
		);
	}

	if ( error && ! data ) {
		return (
			<VStack spacing={ 12 } className="newspack-newsletters-settings">
				<Notice status="error" isDismissible={ false }>
					{ error?.message || __( 'Could not load settings. Refresh the page to try again.', 'newspack-newsletters' ) }
				</Notice>
			</VStack>
		);
	}

	const newsletterOptionsSchema = ( data?.schema || [] ).filter( field => field.key !== LETTERHEAD_KEY );
	const letterheadSchema = ( data?.schema || [] ).filter( field => field.key === LETTERHEAD_KEY );

	return (
		<VStack spacing={ 12 } className="newspack-newsletters-settings">
			<ProviderSection
				provider={ data?.provider }
				providers={ data?.providers }
				pendingSlug={ pendingSlug }
				pendingCredentials={ pendingCredentials }
				onSlugChange={ onSlugChange }
				onCredentialChange={ updateCredential }
				onAuthorized={ handleAuthorized }
				onSave={ handleSave }
				isDirty={ isDirty }
				isSaving={ isSaving }
				disabled={ isSaving }
			/>
			<OptionsSection
				title={ __( 'Newsletter options', 'newspack-newsletters' ) }
				options={ data?.options }
				schema={ newsletterOptionsSchema }
				activeProvider={ savedSlug }
				pendingValues={ pendingOptions }
				onChange={ updateOption }
				onSave={ handleSave }
				isDirty={ isDirty }
				isSaving={ isSaving }
				disabled={ isSaving }
			/>
			<OptionsSection
				title={ __( 'Letterhead', 'newspack-newsletters' ) }
				options={ data?.options }
				schema={ letterheadSchema }
				activeProvider={ savedSlug }
				pendingValues={ pendingOptions }
				onChange={ updateOption }
				onSave={ handleSave }
				isDirty={ isDirty }
				isSaving={ isSaving }
				disabled={ isSaving }
			/>
			<ListsSection
				lists={ lists }
				isLoading={ isListsLoading }
				error={ listsError }
				canAddLocal={ !! data?.lists_can_add_local }
				onPatchList={ patchList }
				onLocalListChanged={ reloadLists }
			/>
		</VStack>
	);
}

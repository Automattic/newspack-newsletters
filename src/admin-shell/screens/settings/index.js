import { Notice } from '@wordpress/components';
import { useCallback, useState } from '@wordpress/element';
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
	const { lists, isLoading: isListsLoading, error: listsError, save: saveLists, reload: reloadLists } = useListsData();

	const [ isSaving, setIsSaving ] = useState( false );

	const handleAuthorized = useCallback( () => {
		reloadSettings();
		reloadLists();
	}, [ reloadSettings, reloadLists ] );

	const handleSettingsSave = useCallback(
		async payload => {
			setIsSaving( true );
			try {
				await saveSettings( payload );
				dispatch( noticesStore ).createSuccessNotice( __( 'Settings saved.', 'newspack-newsletters' ), { type: 'snackbar' } );
				if ( payload?.provider ) {
					reloadLists();
				}
			} catch ( err ) {
				const message = err?.message || __( 'Could not save settings. Check the credentials and try again.', 'newspack-newsletters' );
				dispatch( noticesStore ).createErrorNotice( message, { type: 'snackbar', explicitDismiss: true } );
			} finally {
				setIsSaving( false );
			}
		},
		[ saveSettings, reloadLists ]
	);

	const handleListsSave = useCallback(
		async nextLists => {
			setIsSaving( true );
			try {
				await saveLists( nextLists );
				dispatch( noticesStore ).createSuccessNotice( __( 'Subscription lists saved.', 'newspack-newsletters' ), { type: 'snackbar' } );
			} catch ( err ) {
				const message = err?.message || __( 'Could not save subscription lists.', 'newspack-newsletters' );
				dispatch( noticesStore ).createErrorNotice( message, { type: 'snackbar', explicitDismiss: true } );
				throw err;
			} finally {
				setIsSaving( false );
			}
		},
		[ saveLists ]
	);

	if ( isLoading && ! data ) {
		return (
			<div className="newspack-newsletters-settings">
				<p>{ __( 'Loading settings…', 'newspack-newsletters' ) }</p>
			</div>
		);
	}

	if ( error && ! data ) {
		return (
			<div className="newspack-newsletters-settings">
				<Notice status="error" isDismissible={ false }>
					{ error?.message || __( 'Could not load settings. Refresh the page to try again.', 'newspack-newsletters' ) }
				</Notice>
			</div>
		);
	}

	return (
		<div className="newspack-newsletters-settings">
			<ProviderSection
				provider={ data?.provider }
				providers={ data?.providers }
				onSave={ handleSettingsSave }
				onAuthorized={ handleAuthorized }
				isSaving={ isSaving }
			/>
			<OptionsSection
				title={ __( 'Newsletter options', 'newspack-newsletters' ) }
				options={ data?.options }
				schema={ ( data?.schema || [] ).filter( field => field.key !== LETTERHEAD_KEY ) }
				activeProvider={ data?.provider?.selected }
				onSave={ handleSettingsSave }
				isSaving={ isSaving }
			/>
			<OptionsSection
				title={ __( 'Letterhead', 'newspack-newsletters' ) }
				options={ data?.options }
				schema={ ( data?.schema || [] ).filter( field => field.key === LETTERHEAD_KEY ) }
				activeProvider={ data?.provider?.selected }
				onSave={ handleSettingsSave }
				isSaving={ isSaving }
			/>
			<ListsSection
				lists={ lists }
				isLoading={ isListsLoading }
				error={ listsError }
				canAddLocal={ !! data?.lists_can_add_local }
				onSave={ handleListsSave }
				onLocalListCreated={ reloadLists }
				isSaving={ isSaving }
			/>
		</div>
	);
}

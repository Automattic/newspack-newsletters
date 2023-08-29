/**
 * WordPress dependencies
 */
import { __, sprintf, _n } from '@wordpress/i18n';
import { useSelect, useDispatch } from '@wordpress/data';
import { useState, useEffect, Fragment } from '@wordpress/element';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import { ToggleControl, Button } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';

import { NEWSLETTER_AD_CPT_SLUG } from '../../utils/consts';

export function DisableAutoAds( { saveOnToggle = false } ) {
	const { enableAutoAds, date, isSaving } = useSelect( select => {
		const { getEditedPostAttribute, isSavingPost } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			enableAutoAds: meta.enable_auto_ads,
			date: getEditedPostAttribute( 'date' ),
			isSaving: isSavingPost(),
		};
	} );
	const { editPost, savePost } = useDispatch( 'core/editor' );
	const [ adsCount, setAdsCount ] = useState( {
		count: 0,
		label: __( 'ads', 'newspack-newsletters' ),
	} );
	const [ forceDisableAutoAds, setForceDisableAutoAds ] = useState( false );
	useEffect( () => {
		let hasAdBlock = false;
		postBlocks.forEach( block => {
			if ( block.name === 'newspack-newsletters/ad' ) {
				hasAdBlock = true;
			}
		} );
		setForceDisableAutoAds( hasAdBlock );
	}, [ postBlocks ] );
	const [ inFlight, setInFlight ] = useState( false );
	useEffect( () => {
		setInFlight( true );
		apiFetch( {
			path: `/wp/v2/${ NEWSLETTER_AD_CPT_SLUG }/config/?date=${ date }`,
		} )
			.then( response => {
				setAdsConfig( response );
			} )
			.catch( e => {
				console.warn( e ); // eslint-disable-line no-console
			} )
			.finally( () => {
				setInFlight( false );
			} );
	}, [] );
	return (
		<div>
			<ToggleControl
				label={ __( 'Enable automatic insertion of ads', 'newspack-newsletters' ) }
				checked={ enableAutoAds && ! forceDisableAutoAds }
				disabled={ isSaving }
				onChange={ enable_auto_ads => {
					editPost( { meta: { enable_auto_ads } } );
					if ( saveOnToggle ) {
						savePost();
					}
				} }
			/>
			{ ! inFlight ? (
				<>
					<p>
						{ sprintf(
							// Translators: help message showing number of active ads.
							_n(
								'There is %1$d active %2$s.',
								'There are %1$d active %2$ss.',
								adsCount.count,
								'newspack-newsletters'
							),
							adsCount.count,
							adsCount.label
						) }
					</p>
					<Button // eslint-disable-line react/jsx-no-target-blank
						href={ adsCount.manageUrl }
						rel={ adsCount.manageUrlRel }
						target={ adsCount.manageUrlTarget }
						variant="secondary"
						disabled={ isSaving }
					>
						{
							// Translators: "manage ad" message.
							sprintf( __( 'Manage %ss', 'newspack-newsletters' ), adsCount.label )
						}
					</Button>
				</>
			) : null }
		</div>
	);
}

function NewslettersAdsSettings() {
	return (
		<PluginDocumentSettingPanel
			name="newsletters-ads-settings-panel"
			title={ __( 'Ads Settings', 'newspack-newsletters' ) }
		>
			<DisableAutoAds />
		</PluginDocumentSettingPanel>
	);
}

registerPlugin( 'newspack-newsletters-ads-settings', {
	render: NewslettersAdsSettings,
	icon: null,
} );

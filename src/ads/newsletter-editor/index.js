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
	const { disableAutoAds, date, isSaving, postBlocks } = useSelect( select => {
		const { getEditedPostAttribute, isSavingPost, getBlocks } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			disableAutoAds: meta.disable_auto_ads,
			date: getEditedPostAttribute( 'date' ),
			isSaving: isSavingPost(),
			postBlocks: getBlocks(),
		};
	} );
	const { editPost, savePost } = useDispatch( 'core/editor' );
	const [ adsConfig, setAdsConfig ] = useState( {
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
				label={ __( 'Disable automatic insertion of ads', 'newspack-newsletters' ) }
				checked={ disableAutoAds || forceDisableAutoAds }
				disabled={ isSaving || inFlight || forceDisableAutoAds }
				onChange={ disable_auto_ads => {
					editPost( { meta: { disable_auto_ads } } );
					if ( saveOnToggle ) {
						savePost();
					}
				} }
			/>
			{ forceDisableAutoAds ? (
				<p>
					{ __(
						'Automatic ads insertion is disabled because this post contain manually inserted ad blocks.',
						'newspack-newsletters'
					) }
				</p>
			) : null }
			{ ! inFlight ? (
				<>
					<p>
						{ sprintf(
							// Translators: help message showing number of active ads.
							_n(
								'There is %1$d active %2$s.',
								'There are %1$d active %2$ss.',
								adsConfig.count,
								'newspack-newsletters'
							),
							adsConfig.count,
							adsConfig.label
						) }
					</p>
					<Button // eslint-disable-line react/jsx-no-target-blank
						href={ adsConfig.manageUrl }
						rel={ adsConfig.manageUrlRel }
						target={ adsConfig.manageUrlTarget }
						variant="secondary"
					>
						{
							// Translators: "manage ad" message.
							sprintf( __( 'Manage %ss', 'newspack-newsletters' ), adsConfig.label )
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

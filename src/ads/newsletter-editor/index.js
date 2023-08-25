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

function NewslettersAdsSettings() {
	const { enableAutoAds, date } = useSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return { enableAutoAds: meta.enable_auto_ads, date: getEditedPostAttribute( 'date' ) };
	} );
	const { editPost } = useDispatch( 'core/editor' );
	const [ adsCount, setAdsCount ] = useState( {
		count: 0,
		label: __( 'ads', 'newspack-newsletters' ),
	} );
	const [ inFlight, setInFlight ] = useState( false );
	useEffect( () => {
		setInFlight( true );
		apiFetch( {
			path: `/wp/v2/${ NEWSLETTER_AD_CPT_SLUG }/count/?date=${ date }`,
		} )
			.then( response => {
				setAdsCount( response );
			} )
			.catch( e => {
				console.warn( e ); // eslint-disable-line no-console
			} )
			.finally( () => {
				setInFlight( false );
			} );
	}, [] );
	return (
		<Fragment>
			<PluginDocumentSettingPanel
				name="newsletters-ads-settings-panel"
				title={ __( 'Ads Settings', 'newspack-newsletters' ) }
			>
				<ToggleControl
					label={ __( 'Enable automatic insertion of ads', 'newspack-newsletters' ) }
					checked={ enableAutoAds }
					onChange={ enable_auto_ads => editPost( { meta: { enable_auto_ads } } ) }
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
						>
							{
								// Translators: "manage ad" message.
								sprintf( __( 'Manage %ss', 'newspack-newsletters' ), adsCount.label )
							}
						</Button>
					</>
				) : null }
			</PluginDocumentSettingPanel>
		</Fragment>
	);
}

registerPlugin( 'newspack-newsletters-ads-settings', {
	render: NewslettersAdsSettings,
	icon: null,
} );

/**
 * Quick Edit panel for the newsletter ads list — advertiser,
 * placement, category, start/expiry dates, price. Saves via
 * `POST /wp/v2/newspack_nl_ads_cpt/{id}` and refreshes the list.
 *
 * Status is not editable here: the editor still owns the lifecycle,
 * and Insertion strategy / position stay in the full editor too —
 * they're too granular for an inline panel.
 */

import apiFetch from '@wordpress/api-fetch';
import { FormTokenField, TextControl } from '@wordpress/components';
import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import QuickEditPanel from '../../components/quick-edit-panel';
import { notifyError, notifySuccess } from '../../notices';

const POSTS_PATH = '/wp/v2/newspack_nl_ads_cpt';

const termsForTaxonomy = ( item, taxonomy ) => {
	const groups = item?._embedded?.[ 'wp:term' ] || [];
	for ( const group of groups ) {
		if ( Array.isArray( group ) && group.length > 0 && group[ 0 ]?.taxonomy === taxonomy ) {
			return group;
		}
	}
	return [];
};

const initialTokensForTaxonomy = ( item, taxonomy ) =>
	termsForTaxonomy( item, taxonomy )
		.map( term => term?.name )
		.filter( Boolean );

const labelsToIds = ( options, tokens, idKey, labelKey ) => {
	const byLabel = new Map( options.map( o => [ String( o[ labelKey ] ).toLowerCase(), o[ idKey ] ] ) );
	return tokens.map( token => byLabel.get( String( token ).toLowerCase() ) ).filter( id => typeof id === 'number' );
};

export default function AdsQuickEditPanel( { item, advertisers, placements, categories, onClose, onSaved } ) {
	const [ advertiserTokens, setAdvertiserTokens ] = useState( () => initialTokensForTaxonomy( item, 'newspack_nl_advertiser' ) );
	const [ placementTokens, setPlacementTokens ] = useState( () => initialTokensForTaxonomy( item, 'newspack_nl_ad_placement' ) );
	const [ categoryTokens, setCategoryTokens ] = useState( () => initialTokensForTaxonomy( item, 'category' ) );
	const [ startDate, setStartDate ] = useState( item?.meta?.start_date || '' );
	const [ expiryDate, setExpiryDate ] = useState( item?.meta?.expiry_date || '' );
	const [ price, setPrice ] = useState( () => {
		const value = item?.meta?.price;
		return value === undefined || value === null ? '' : String( value );
	} );
	const [ isBusy, setIsBusy ] = useState( false );

	const advertiserSuggestions = useMemo( () => advertisers.map( t => String( t.name ) ), [ advertisers ] );
	const placementSuggestions = useMemo( () => placements.map( t => String( t.name ) ), [ placements ] );
	const categorySuggestions = useMemo( () => categories.map( t => String( t.name ) ), [ categories ] );

	const validateAgainst = labels => {
		const lower = new Set( labels.map( l => l.toLowerCase() ) );
		return token => lower.has( String( token ).toLowerCase() );
	};

	const validateAdvertiser = useMemo( () => validateAgainst( advertiserSuggestions ), [ advertiserSuggestions ] );
	const validatePlacement = useMemo( () => validateAgainst( placementSuggestions ), [ placementSuggestions ] );
	const validateCategory = useMemo( () => validateAgainst( categorySuggestions ), [ categorySuggestions ] );

	const datesValid = ! startDate || ! expiryDate || startDate <= expiryDate;
	const priceValid = price === '' || ! Number.isNaN( Number( price ) );
	const canSave = datesValid && priceValid;

	const handleSave = async () => {
		setIsBusy( true );
		const meta = {
			start_date: startDate,
			expiry_date: expiryDate,
		};
		if ( price === '' ) {
			meta.price = 0;
		} else {
			meta.price = Number( price );
		}
		const data = {
			newspack_nl_advertiser: labelsToIds( advertisers, advertiserTokens, 'id', 'name' ),
			ad_placement: labelsToIds( placements, placementTokens, 'id', 'name' ),
			categories: labelsToIds( categories, categoryTokens, 'id', 'name' ),
			meta,
		};
		try {
			await apiFetch( { path: `${ POSTS_PATH }/${ item.id }`, method: 'POST', data } );
			notifySuccess( __( 'Ad updated.', 'newspack-newsletters' ) );
			onSaved();
		} catch ( error ) {
			setIsBusy( false );
			notifyError( error?.message || __( 'Could not update ad. Please try again.', 'newspack-newsletters' ) );
		}
	};

	return (
		<QuickEditPanel
			title={ __( 'Quick edit', 'newspack-newsletters' ) }
			onClose={ onClose }
			onSave={ handleSave }
			isBusy={ isBusy }
			canSave={ canSave }
			saveLabel={ __( 'Save', 'newspack-newsletters' ) }
		>
			<FormTokenField
				label={ __( 'Advertiser', 'newspack-newsletters' ) }
				value={ advertiserTokens }
				suggestions={ advertiserSuggestions }
				onChange={ setAdvertiserTokens }
				__experimentalValidateInput={ validateAdvertiser }
				__experimentalShowHowTo={ false }
				__nextHasNoMarginBottom
			/>
			<FormTokenField
				label={ __( 'Ad placement', 'newspack-newsletters' ) }
				value={ placementTokens }
				suggestions={ placementSuggestions }
				onChange={ setPlacementTokens }
				__experimentalValidateInput={ validatePlacement }
				__experimentalShowHowTo={ false }
				__nextHasNoMarginBottom
			/>
			<FormTokenField
				label={ __( 'Categories', 'newspack-newsletters' ) }
				value={ categoryTokens }
				suggestions={ categorySuggestions }
				onChange={ setCategoryTokens }
				__experimentalValidateInput={ validateCategory }
				__experimentalShowHowTo={ false }
				__nextHasNoMarginBottom
			/>
			<TextControl
				type="date"
				label={ __( 'Start date', 'newspack-newsletters' ) }
				value={ startDate }
				onChange={ setStartDate }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			<TextControl
				type="date"
				label={ __( 'Expiration date', 'newspack-newsletters' ) }
				value={ expiryDate }
				onChange={ setExpiryDate }
				help={ datesValid ? '' : __( 'Expiration date must be on or after the start date.', 'newspack-newsletters' ) }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			<TextControl
				type="number"
				label={ __( 'Price', 'newspack-newsletters' ) }
				value={ price }
				min={ 0 }
				step="0.01"
				onChange={ setPrice }
				help={ priceValid ? '' : __( 'Price must be a number.', 'newspack-newsletters' ) }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
		</QuickEditPanel>
	);
}

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
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { emailAd } from 'newspack-icons';

import QuickEditPanel from '../../components/quick-edit-panel';
import { notifyError, notifySuccess } from '../../notices';

const POSTS_PATH = '/wp/v2/newspack_nl_ads_cpt';
const TERMS_PER_PAGE = 100;

async function fetchAllTerms( basePath ) {
	const all = [];
	let page = 1;
	let totalPages = 1;
	while ( page <= totalPages ) {
		try {
			const response = await apiFetch( {
				path: `${ basePath }?per_page=${ TERMS_PER_PAGE }&_fields=id,name&page=${ page }`,
				parse: false,
			} );
			const data = await response.json();
			if ( ! Array.isArray( data ) ) {
				break;
			}
			all.push( ...data );
			if ( page === 1 ) {
				const headerPages = parseInt( response.headers?.get?.( 'X-WP-TotalPages' ) || '1', 10 );
				totalPages = Number.isFinite( headerPages ) && headerPages > 0 ? headerPages : 1;
			}
		} catch ( error ) {
			break;
		}
		page += 1;
	}
	return all;
}

function useQuickEditCategories() {
	const [ categories, setCategories ] = useState( [] );
	useEffect( () => {
		let cancelled = false;
		fetchAllTerms( '/wp/v2/categories' ).then( terms => {
			if ( ! cancelled ) {
				setCategories( Array.isArray( terms ) ? terms : [] );
			}
		} );
		return () => {
			cancelled = true;
		};
	}, [] );
	return categories;
}

const termsForTaxonomy = ( item, taxonomy ) => {
	const groups = item?._embedded?.[ 'wp:term' ] || [];
	for ( const group of groups ) {
		if ( Array.isArray( group ) && group.length > 0 && group[ 0 ]?.taxonomy === taxonomy ) {
			return group;
		}
	}
	return [];
};

const initialSelectionsForTaxonomy = ( item, taxonomy ) =>
	termsForTaxonomy( item, taxonomy )
		.map( term => ( { id: term?.id, name: term?.name } ) )
		.filter( s => typeof s.id === 'number' && s.name );

const sortedIdsEqual = ( a, b ) => {
	if ( a.length !== b.length ) {
		return false;
	}
	const sa = a.map( s => s.id ).sort();
	const sb = b.map( s => s.id ).sort();
	return sa.every( ( v, i ) => v === sb[ i ] );
};

// See newsletters quick-edit-panel.js for the rationale (name-keyed
// lookup is ambiguous when taxonomies allow duplicate term names).
const resolveTokens = ( newTokens, currentSelections, options ) =>
	newTokens
		.map( token => {
			const name = typeof token === 'string' ? token : token.value;
			const existing = currentSelections.find( s => s.name.toLowerCase() === String( name ).toLowerCase() );
			if ( existing ) {
				return existing;
			}
			const match = options.find( o => String( o.name ).toLowerCase() === String( name ).toLowerCase() );
			return match ? { id: match.id, name: match.name } : null;
		} )
		.filter( Boolean );

export default function AdsQuickEditPanel( { item, advertisers, placements, onClose, onSaved } ) {
	const categories = useQuickEditCategories();
	const initialAdvertiserSelections = useMemo( () => initialSelectionsForTaxonomy( item, 'newspack_nl_advertiser' ), [ item ] );
	const initialPlacementSelections = useMemo( () => initialSelectionsForTaxonomy( item, 'newspack_nl_ad_placement' ), [ item ] );
	const initialCategorySelections = useMemo( () => initialSelectionsForTaxonomy( item, 'category' ), [ item ] );
	const initialStartDate = item?.meta?.start_date || '';
	const initialExpiryDate = item?.meta?.expiry_date || '';
	const initialPrice = ( () => {
		const value = item?.meta?.price;
		return value === undefined || value === null ? '' : String( value );
	} )();

	const [ advertiserSelections, setAdvertiserSelections ] = useState( initialAdvertiserSelections );
	const [ placementSelections, setPlacementSelections ] = useState( initialPlacementSelections );
	const [ categorySelections, setCategorySelections ] = useState( initialCategorySelections );
	const [ startDate, setStartDate ] = useState( initialStartDate );
	const [ expiryDate, setExpiryDate ] = useState( initialExpiryDate );
	const [ price, setPrice ] = useState( initialPrice );
	const [ isBusy, setIsBusy ] = useState( false );

	const isDirty =
		startDate !== initialStartDate ||
		expiryDate !== initialExpiryDate ||
		price !== initialPrice ||
		! sortedIdsEqual( advertiserSelections, initialAdvertiserSelections ) ||
		! sortedIdsEqual( placementSelections, initialPlacementSelections ) ||
		! sortedIdsEqual( categorySelections, initialCategorySelections );

	const advertiserSuggestions = useMemo( () => advertisers.map( t => String( t.name ) ), [ advertisers ] );
	const placementSuggestions = useMemo( () => placements.map( t => String( t.name ) ), [ placements ] );
	const categorySuggestions = useMemo( () => categories.map( t => String( t.name ) ), [ categories ] );
	const advertiserTokens = useMemo( () => advertiserSelections.map( s => s.name ), [ advertiserSelections ] );
	const placementTokens = useMemo( () => placementSelections.map( s => s.name ), [ placementSelections ] );
	const categoryTokens = useMemo( () => categorySelections.map( s => s.name ), [ categorySelections ] );

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
		// Omit `price` when blank so previously-unset ads stay unset.
		const meta = {
			start_date: startDate,
			expiry_date: expiryDate,
		};
		if ( price !== '' ) {
			meta.price = Number( price );
		}
		const data = {
			newspack_nl_advertiser: advertiserSelections.map( s => s.id ),
			ad_placement: placementSelections.map( s => s.id ),
			categories: categorySelections.map( s => s.id ),
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

	const subjectTitle = item?.title?.raw ?? item?.title?.rendered ?? __( '(no title)', 'newspack-newsletters' );

	return (
		<QuickEditPanel
			title={ __( 'Quick edit', 'newspack-newsletters' ) }
			icon={ emailAd }
			subjectTitle={ subjectTitle }
			isDirty={ isDirty }
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
				onChange={ next => setAdvertiserSelections( resolveTokens( next, advertiserSelections, advertisers ) ) }
				__experimentalValidateInput={ validateAdvertiser }
				__experimentalShowHowTo={ false }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<FormTokenField
				label={ __( 'Ad placement', 'newspack-newsletters' ) }
				value={ placementTokens }
				suggestions={ placementSuggestions }
				onChange={ next => setPlacementSelections( resolveTokens( next, placementSelections, placements ) ) }
				__experimentalValidateInput={ validatePlacement }
				__experimentalShowHowTo={ false }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<FormTokenField
				label={ __( 'Categories', 'newspack-newsletters' ) }
				value={ categoryTokens }
				suggestions={ categorySuggestions }
				onChange={ next => setCategorySelections( resolveTokens( next, categorySelections, categories ) ) }
				__experimentalValidateInput={ validateCategory }
				__experimentalShowHowTo={ false }
				__next40pxDefaultSize
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

/**
 * Quick Edit panel for the newsletters list. Lazy-loads full term and
 * author sets so newsletters can be assigned categories/tags/authors
 * that aren't already used elsewhere. Status is intentionally absent —
 * the service-provider base class fires an ESP send on
 * `transition_post_status`.
 */

import apiFetch from '@wordpress/api-fetch';
import { ComboboxControl, FormTokenField, RadioControl } from '@wordpress/components';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { envelope } from '@wordpress/icons';

import QuickEditPanel from '../../components/quick-edit-panel';
import { notifyError, notifySuccess } from '../../notices';

const POSTS_PATH = '/wp/v2/newspack_nl_cpt';
const TERMS_PER_PAGE = 100;

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

const sortedTokensEqual = ( a, b ) => {
	if ( a.length !== b.length ) {
		return false;
	}
	const sa = [ ...a ].map( String ).sort();
	const sb = [ ...b ].map( String ).sort();
	return sa.every( ( v, i ) => v === sb[ i ] );
};

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

function useQuickEditOptions() {
	const [ options, setOptions ] = useState( { authors: [], categories: [], tags: [] } );

	useEffect( () => {
		let cancelled = false;
		Promise.all( [
			apiFetch( { path: '/newspack-newsletters/v1/newsletters-list/quick-edit-authors' } ).catch( () => [] ),
			fetchAllTerms( '/wp/v2/categories' ),
			fetchAllTerms( '/wp/v2/tags' ),
		] ).then( ( [ authors, categories, tags ] ) => {
			if ( cancelled ) {
				return;
			}
			setOptions( {
				authors: Array.isArray( authors ) ? authors : [],
				categories: Array.isArray( categories ) ? categories : [],
				tags: Array.isArray( tags ) ? tags : [],
			} );
		} );
		return () => {
			cancelled = true;
		};
	}, [] );

	return options;
}

export default function NewslettersQuickEditPanel( { item, onClose, onSaved } ) {
	const { authors, categories, tags } = useQuickEditOptions();

	const initialAuthor = item?._embedded?.author?.[ 0 ]?.id ?? item?.author ?? '';
	const initialAuthorId = initialAuthor ? String( initialAuthor ) : '';
	const initialCategoryTokens = useMemo( () => initialTokensForTaxonomy( item, 'category' ), [ item ] );
	const initialTagTokens = useMemo( () => initialTokensForTaxonomy( item, 'post_tag' ), [ item ] );
	const initialVisibility = item?.meta?.is_public ? 'public' : 'private';

	const [ authorId, setAuthorId ] = useState( initialAuthorId );
	const [ categoryTokens, setCategoryTokens ] = useState( initialCategoryTokens );
	const [ tagTokens, setTagTokens ] = useState( initialTagTokens );
	const [ visibility, setVisibility ] = useState( initialVisibility );
	const [ isBusy, setIsBusy ] = useState( false );

	const isDirty =
		authorId !== initialAuthorId ||
		visibility !== initialVisibility ||
		! sortedTokensEqual( categoryTokens, initialCategoryTokens ) ||
		! sortedTokensEqual( tagTokens, initialTagTokens );

	const authorOptions = useMemo(
		() =>
			authors.map( ( { id, name } ) => ( {
				value: String( id ),
				label: String( name ),
			} ) ),
		[ authors ]
	);

	const categoryNames = useMemo( () => categories.map( c => String( c.name ) ), [ categories ] );
	const tagNames = useMemo( () => tags.map( t => String( t.name ) ), [ tags ] );

	const validateAgainst = names => {
		const lower = new Set( names.map( n => n.toLowerCase() ) );
		return token => lower.has( String( token ).toLowerCase() );
	};

	const validateCategory = useMemo( () => validateAgainst( categoryNames ), [ categoryNames ] );
	const validateTag = useMemo( () => validateAgainst( tagNames ), [ tagNames ] );

	const namesToIds = ( options, tokens ) => {
		const byName = new Map( options.map( o => [ String( o.name ).toLowerCase(), o.id ] ) );
		return tokens.map( token => byName.get( String( token ).toLowerCase() ) ).filter( id => typeof id === 'number' );
	};

	const handleSave = async () => {
		setIsBusy( true );
		const data = {
			categories: namesToIds( categories, categoryTokens ),
			tags: namesToIds( tags, tagTokens ),
			meta: { is_public: visibility === 'public' },
		};
		if ( authorId ) {
			data.author = parseInt( authorId, 10 );
		}
		try {
			await apiFetch( { path: `${ POSTS_PATH }/${ item.id }`, method: 'POST', data } );
			notifySuccess( __( 'Newsletter updated.', 'newspack-newsletters' ) );
			onSaved();
		} catch ( error ) {
			setIsBusy( false );
			notifyError( error?.message || __( 'Could not update newsletter. Please try again.', 'newspack-newsletters' ) );
		}
	};

	const subjectTitle = item?.title?.raw ?? item?.title?.rendered ?? __( '(no subject)', 'newspack-newsletters' );

	return (
		<QuickEditPanel
			title={ __( 'Quick edit', 'newspack-newsletters' ) }
			icon={ envelope }
			subjectTitle={ subjectTitle }
			isDirty={ isDirty }
			onClose={ onClose }
			onSave={ handleSave }
			isBusy={ isBusy }
			saveLabel={ __( 'Save', 'newspack-newsletters' ) }
		>
			<ComboboxControl
				label={ __( 'Author', 'newspack-newsletters' ) }
				value={ authorId }
				options={ authorOptions }
				onChange={ next => setAuthorId( next || '' ) }
				allowReset
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			<FormTokenField
				label={ __( 'Categories', 'newspack-newsletters' ) }
				value={ categoryTokens }
				suggestions={ categoryNames }
				onChange={ setCategoryTokens }
				__experimentalValidateInput={ validateCategory }
				__experimentalShowHowTo={ false }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<FormTokenField
				label={ __( 'Tags', 'newspack-newsletters' ) }
				value={ tagTokens }
				suggestions={ tagNames }
				onChange={ setTagTokens }
				__experimentalValidateInput={ validateTag }
				__experimentalShowHowTo={ false }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<RadioControl
				label={ __( 'Visibility', 'newspack-newsletters' ) }
				selected={ visibility }
				options={ [
					{
						label: __( 'Email and web', 'newspack-newsletters' ),
						value: 'public',
						description: __( 'Sent by email and published as an article on your site.', 'newspack-newsletters' ),
					},
					{
						label: __( 'Email only', 'newspack-newsletters' ),
						value: 'private',
						description: __( 'Sent by email only; not visible on your site.', 'newspack-newsletters' ),
					},
				] }
				onChange={ setVisibility }
			/>
		</QuickEditPanel>
	);
}

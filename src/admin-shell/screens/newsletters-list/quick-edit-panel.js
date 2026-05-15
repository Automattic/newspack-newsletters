/**
 * Quick Edit panel for the newsletters list — categories, tags, author.
 * Saves via `POST /wp/v2/newspack_nl_cpt/{id}` and refreshes the list.
 * Status stays off the form: the service-provider base class fires an
 * ESP campaign send on `transition_post_status`, which would dispatch
 * irreversibly from an inline edit.
 */

import apiFetch from '@wordpress/api-fetch';
import { ComboboxControl, FormTokenField, RadioControl } from '@wordpress/components';
import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { envelope } from '@wordpress/icons';

import QuickEditPanel from '../../components/quick-edit-panel';
import { notifyError, notifySuccess } from '../../notices';

const POSTS_PATH = '/wp/v2/newspack_nl_cpt';

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

export default function NewslettersQuickEditPanel( { item, authors, categories, tags, onClose, onSaved } ) {
	const initialAuthor = item?._embedded?.author?.[ 0 ]?.id ?? item?.author ?? '';
	const [ authorId, setAuthorId ] = useState( initialAuthor ? String( initialAuthor ) : '' );
	const [ categoryTokens, setCategoryTokens ] = useState( () => initialTokensForTaxonomy( item, 'category' ) );
	const [ tagTokens, setTagTokens ] = useState( () => initialTokensForTaxonomy( item, 'post_tag' ) );
	const [ visibility, setVisibility ] = useState( item?.meta?.is_public ? 'public' : 'private' );
	const [ isBusy, setIsBusy ] = useState( false );

	const authorOptions = useMemo(
		() =>
			authors.map( ( { id, label } ) => ( {
				value: String( id ),
				label: String( label ),
			} ) ),
		[ authors ]
	);

	const categoryLabels = useMemo( () => categories.map( c => String( c.label ) ), [ categories ] );
	const tagLabels = useMemo( () => tags.map( t => String( t.label ) ), [ tags ] );

	const validateAgainst = labels => {
		const lower = new Set( labels.map( l => l.toLowerCase() ) );
		return token => lower.has( String( token ).toLowerCase() );
	};

	const validateCategory = useMemo( () => validateAgainst( categoryLabels ), [ categoryLabels ] );
	const validateTag = useMemo( () => validateAgainst( tagLabels ), [ tagLabels ] );

	const labelsToIds = ( options, tokens ) => {
		const byLabel = new Map( options.map( o => [ String( o.label ).toLowerCase(), o.id ] ) );
		return tokens.map( token => byLabel.get( String( token ).toLowerCase() ) ).filter( id => typeof id === 'number' );
	};

	const handleSave = async () => {
		setIsBusy( true );
		const data = {
			categories: labelsToIds( categories, categoryTokens ),
			tags: labelsToIds( tags, tagTokens ),
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

	const subjectTitle = item?.title?.raw ?? item?.title?.rendered ?? __( '(no title)', 'newspack-newsletters' );

	return (
		<QuickEditPanel
			title={ __( 'Quick edit', 'newspack-newsletters' ) }
			icon={ envelope }
			subjectTitle={ subjectTitle }
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
				suggestions={ categoryLabels }
				onChange={ setCategoryTokens }
				__experimentalValidateInput={ validateCategory }
				__experimentalShowHowTo={ false }
				__next40pxDefaultSize
				__nextHasNoMarginBottom
			/>
			<FormTokenField
				label={ __( 'Tags', 'newspack-newsletters' ) }
				value={ tagTokens }
				suggestions={ tagLabels }
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

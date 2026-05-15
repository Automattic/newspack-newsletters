/**
 * External dependencies
 */
import { uniqBy } from 'lodash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { STORE_NAMESPACE } from '../../../newsletter-editor/store';

/* globals newspack_email_editor_data */

const EMPTY_MERGE_FIELDS = [];

const escapeRegExp = str => str.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
const stripDiacritics = str => str.normalize( 'NFD' ).replace( /\p{Diacritic}/gu, '' );

export const getStaticTags = () => newspack_email_editor_data?.merge_tags?.tags || [];
export const getLabel = () => newspack_email_editor_data?.merge_tags?.label || __( 'merge tag', 'newspack-newsletters' );
export const getTriggerPrefix = () => newspack_email_editor_data?.merge_tags?.trigger_prefix || '*|';

export const buildOptions = listMergeFields =>
	uniqBy(
		[
			...listMergeFields.map( mergeField => ( {
				tag: `*|${ mergeField.tag }|*`,
				label: mergeField.name,
				keywords: [ 'list', 'audience', ...mergeField.name.split( ' ' ) ],
			} ) ),
			...getStaticTags(),
		],
		'tag'
	);

export const getOptionLabelNode = ( { tag, label } ) => (
	<div className="newspack-completer-merge-tags">
		<code>{ tag }</code>
		<p>{ label }</p>
	</div>
);

export const getOptionKeywords = ( { tag, keywords } ) => [ tag, ...( keywords || [] ) ];

// Default useItems caps results at 10; ours bypasses that so the full tag list is searchable.
// Subscribe to merge_fields so the list refreshes when the store data resolves (Mailchimp only).
// Returns a single-element tuple to match Gutenberg's Autocomplete `useItems` contract; the toolbar picker destructures it.
export const useMergeTagItems = filterValue => {
	const listMergeFields = useSelect( select => select( STORE_NAMESPACE )?.getData?.()?.merge_fields ?? EMPTY_MERGE_FIELDS, [] );
	const items = useMemo( () => {
		const opts = buildOptions( listMergeFields );
		const keyed = opts.map( ( opt, i ) => ( {
			key: `merge-tags-${ i }`,
			value: opt,
			label: getOptionLabelNode( opt ),
			keywords: getOptionKeywords( opt ),
		} ) );
		if ( ! filterValue ) {
			return keyed;
		}
		const search = new RegExp( '(?:\\b|\\s|^)' + escapeRegExp( stripDiacritics( filterValue ) ), 'i' );
		return keyed.filter( item => item.keywords.some( k => search.test( stripDiacritics( k ) ) ) );
	}, [ filterValue, listMergeFields ] );
	return [ items ];
};

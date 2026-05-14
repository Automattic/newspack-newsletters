/**
 * External dependencies
 */
import { uniqBy } from 'lodash';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { STORE_NAMESPACE } from '../../../newsletter-editor/store';
import './style.scss';

/* globals newspack_email_editor_data */

const TRIGGER_PREFIX = '*|';
const EMPTY_MERGE_FIELDS = [];

const escapeRegExp = str => str.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
const stripDiacritics = str => str.normalize( 'NFD' ).replace( /\p{Diacritic}/gu, '' );

const getStaticTags = () => newspack_email_editor_data?.merge_tags?.tags || [];
const getLabel = () => newspack_email_editor_data?.merge_tags?.label || __( 'merge tag', 'newspack-newsletters' );

const buildOptions = listMergeFields =>
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

const getOptionLabel = ( { tag, label } ) => (
	<div className="newspack-completer-merge-tags">
		<code>{ tag }</code>
		<p>{ label }</p>
	</div>
);

const getOptionKeywords = ( { tag, keywords } ) => [ tag, ...( keywords || [] ) ];

// Default useItems caps results at 10; ours bypasses that so the full tag list is searchable.
// Subscribe to merge_fields so the list refreshes when the store data resolves (Mailchimp only).
const useMergeTagItems = filterValue => {
	const listMergeFields = useSelect( select => select( STORE_NAMESPACE )?.getData?.()?.merge_fields ?? EMPTY_MERGE_FIELDS, [] );
	const items = useMemo( () => {
		const opts = buildOptions( listMergeFields );
		const keyed = opts.map( ( opt, i ) => ( {
			key: `merge-tags-${ i }`,
			value: opt,
			label: getOptionLabel( opt ),
			keywords: getOptionKeywords( opt ),
		} ) );
		const search = new RegExp( '(?:\\b|\\s|^)' + escapeRegExp( stripDiacritics( filterValue ) ), 'i' );
		return keyed.filter( item => item.keywords.some( k => search.test( stripDiacritics( k ) ) ) );
	}, [ filterValue, listMergeFields ] );
	return [ items ];
};

const getCompleter = () => ( {
	name: 'Merge Tags',
	triggerPrefix: TRIGGER_PREFIX,
	// `options` is required by Gutenberg's Autocomplete API but unused at runtime — `useItems` takes precedence when both are provided.
	options: () => buildOptions( [] ),
	useItems: useMergeTagItems,
	getOptionLabel,
	getOptionKeywords,
	getOptionCompletion: ( { tag } ) => tag,
} );

export default () => {
	const tags = getStaticTags();
	if ( ! tags.length ) {
		return;
	}

	const label = getLabel();

	const updateParagraphPlaceholder = ( settings, name ) => {
		if ( name === 'core/paragraph' ) {
			settings.attributes.placeholder.default = sprintf(
				/* translators: %s: ESP-native singular noun, e.g. "merge tag" or "personalization tag". */
				__( 'Type / to choose a block, or *| to add a %s', 'newspack-newsletters' ),
				label
			);
		}
		return settings;
	};
	const addMergeTagsCompleter = ( completers, blockName ) => ( blockName === 'core/paragraph' ? [ ...completers, getCompleter() ] : completers );

	wp.hooks.addFilter( 'blocks.registerBlockType', 'newspack-newsletters/merge-tags-placeholder', updateParagraphPlaceholder );
	wp.hooks.addFilter( 'editor.Autocomplete.completers', 'newspack-newsletters/autocompleters/merge-tags', addMergeTagsCompleter );
};

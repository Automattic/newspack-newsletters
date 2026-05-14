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
import { getServiceProvider } from '../../../service-providers';
import { STORE_NAMESPACE } from '../../../newsletter-editor/store';
import tags from './merge-tags';
import './style.scss';

const escapeRegExp = str => str.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
const stripDiacritics = str => str.normalize( 'NFD' ).replace( /\p{Diacritic}/gu, '' );

const buildOptions = listMergeFields =>
	uniqBy(
		[
			...listMergeFields.map( mergeField => ( {
				tag: `*|${ mergeField.tag }|*`,
				label: mergeField.name,
				keywords: [ 'list', 'audience', ...mergeField.name.split( ' ' ) ],
			} ) ),
			...tags,
		],
		'tag'
	);

const getOptions = () => buildOptions( wp.data.select( STORE_NAMESPACE )?.getData?.()?.merge_fields || [] );

const getOptionLabel = ( { tag, label } ) => (
	<div className="newspack-completer-mc-merge-tags">
		<code>{ tag }</code>
		<p>{ label }</p>
	</div>
);

const getOptionKeywords = ( { tag, keywords } ) => [ tag, ...( keywords || [] ) ];

// Default useItems caps results at 10; ours bypasses that so the full tag list is searchable.
// Subscribe to merge_fields so the list refreshes when the store data resolves.
const useMergeTagItems = filterValue => {
	const listMergeFields = useSelect( select => select( STORE_NAMESPACE )?.getData?.()?.merge_fields, [] ) || [];
	const items = useMemo( () => {
		const opts = buildOptions( listMergeFields );
		const keyed = opts.map( ( opt, i ) => ( {
			key: `mailchimp-merge-tags-${ i }`,
			value: opt,
			label: getOptionLabel( opt ),
			keywords: getOptionKeywords( opt ),
		} ) );
		const search = new RegExp( '(?:\\b|\\s|^)' + escapeRegExp( stripDiacritics( filterValue ) ), 'i' );
		return keyed.filter( item => item.keywords.some( k => search.test( stripDiacritics( k ) ) ) );
	}, [ filterValue, listMergeFields ] );
	return [ items ];
};

/**
 * Merge tags completer configuration.
 *
 * @return {Object} Completer configuration.
 */
const getCompleter = () => ( {
	name: 'Mailchimp Merge Tags',
	triggerPrefix: '*|',
	options: getOptions,
	useItems: useMergeTagItems,
	getOptionLabel,
	getOptionKeywords,
	getOptionCompletion: ( { tag } ) => tag,
} );

export default () => {
	const { name: serviceProviderName } = getServiceProvider();
	const updateParagraphPlaceholder = ( settings, name ) => {
		if ( name === 'core/paragraph' ) {
			settings.attributes.placeholder.default = __( 'Type / to choose a block, or *| to add a merge tag', 'newspack-newsletters' );
		}
		return settings;
	};
	const addMergeTagsCompleter = ( completers, blockName ) => {
		return blockName === 'core/paragraph' ? [ ...completers, getCompleter() ] : completers;
	};
	if ( serviceProviderName === 'mailchimp' ) {
		wp.hooks.addFilter( 'blocks.registerBlockType', 'newspack-newsletters/mailchimp-merge-tags-placeholder', updateParagraphPlaceholder );
		wp.hooks.addFilter( 'editor.Autocomplete.completers', 'newspack-newsletters/autocompleters/mailchimp-merge-tags', addMergeTagsCompleter );
	}
};

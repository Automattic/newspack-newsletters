/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import { buildOptions, getOptionLabelNode, getOptionKeywords, getTriggerPrefix, useMergeTagItems } from './utils';

const getCompleter = () => ( {
	name: 'Merge Tags',
	triggerPrefix: getTriggerPrefix(),
	// `options` is required by Gutenberg's Autocomplete API but unused at runtime — `useItems` takes precedence when both are provided.
	options: () => buildOptions( [] ),
	useItems: useMergeTagItems,
	getOptionLabel: getOptionLabelNode,
	getOptionKeywords,
	getOptionCompletion: ( { tag } ) => tag,
} );

export default () => {
	const addMergeTagsCompleter = ( completers, blockName ) => ( blockName === 'core/paragraph' ? [ ...completers, getCompleter() ] : completers );
	addFilter( 'editor.Autocomplete.completers', 'newspack-newsletters/autocompleters/merge-tags', addMergeTagsCompleter );
};

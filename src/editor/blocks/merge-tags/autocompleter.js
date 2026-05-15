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
	// Required by the Autocomplete API but unused — `useItems` takes precedence.
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

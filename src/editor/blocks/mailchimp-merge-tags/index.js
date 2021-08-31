/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getServiceProvider } from '../../../service-providers';
import tags from './merge-tags';
import './style.scss';

/**
 * Supported merge tags.
 * Empty array means all merge tags are supported.
 */
const supportedTags = [];

/**
 * Merge tags completer configuration.
 *
 * @param {Object[]} initialTags Initial tags to use as options.
 *
 * @return {Object} Completer configuration.
 */
const completer = ( initialTags = [] ) => ( {
	name: 'Mailchimp Merge Tags',
	triggerPrefix: '*|',
	options: [
		...initialTags,
		...( supportedTags.length
			? tags.filter( tag => supportedTags.indexOf( tag.tag ) !== -1 )
			: tags ),
	],
	getOptionLabel: ( { tag, label } ) => (
		<div>
			<code>{ tag }</code>
			<p className="newspack-completer-mc-merge-tags-label">{ label }</p>
		</div>
	),
	getOptionKeywords: ( { tag, keywords } ) => [ tag, ...( keywords || [] ) ],
	getOptionCompletion: ( { tag } ) => tag,
} );

export default () => {
	const { name: serviceProviderName } = getServiceProvider();
	const updateParagraphPlaceholder = ( settings, name ) => {
		if ( name === 'core/paragraph' ) {
			settings.attributes.placeholder.default = __(
				'Type / to choose a block, or *| to add a merge tag',
				'newspack-newsletters'
			);
		}
		return settings;
	};
	const addMergeTagsCompleter = ( completers, blockName ) => {
		const { getCurrentPostAttribute } = wp.data.select( 'core/editor' );
		const listMergeFields = getCurrentPostAttribute( 'meta' ).newsletterData?.merge_fields || [];
		return blockName === 'core/paragraph'
			? [
					...completers,
					completer(
						listMergeFields.map( mergeField => ( {
							tag: `*|${ mergeField.tag }|*`,
							label: mergeField.name,
							keywords: [ 'list', 'audience', ...mergeField.name.split( ' ' ) ],
						} ) )
					),
			  ]
			: completers;
	};
	if ( serviceProviderName === 'mailchimp' ) {
		wp.hooks.addFilter(
			'blocks.registerBlockType',
			'newspack-newsletters/mailchimp-merge-tags-placeholder',
			updateParagraphPlaceholder
		);
		wp.hooks.addFilter(
			'editor.Autocomplete.completers',
			'newspack-newsletters/autocompleters/mailchimp-merge-tags',
			addMergeTagsCompleter
		);
	}
};

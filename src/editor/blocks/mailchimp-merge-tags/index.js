/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './style.scss';

/**
 * MailChimp merge tags.
 */
const tags = [
	{
		tag: '*|ARCHIVE|*',
		label: __(
			'Creates a "View this email in your browser link" to your campaign page.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|FNAME|*',
		label: __(
			"Inserts your subscriber's first name if it's available in your audience.",
			'newspack-newsletters'
		),
		keywords: [ 'first name' ],
	},
	{
		tag: '*|LNAME|*',
		label: __(
			"Inserts your subscriber's last name if it's available in your audience.",
			'newspack-newsletters'
		),
		keywords: [ 'last name' ],
	},
	{
		tag: '*|TWITTER:PROFILE|*',
		label: __(
			"Populates your campaign with your Twitter avatar, follower, tweet, and following counts; and a follow link. Doesn't include your latest tweets.",
			'newspack-newsletters'
		),
	},
];

/**
 * Merge tags completer configuration.
 */
const completer = {
	name: 'Mailchimp Merge Tags',
	triggerPrefix: '*|',
	options: tags,
	getOptionLabel: ( { tag, label } ) => (
		<div>
			<code>{ tag }</code>
			<p className="newspack-completer-mc-merge-tags-label">{ label }</p>
		</div>
	),
	getOptionKeywords: ( { tag, keywords } ) => [ tag, ...( keywords || [] ) ],
	getOptionCompletion: ( { tag } ) => tag,
};

export default () => {
	const updateParagraphPlaceholder = ( settings, name ) => {
		if ( name === 'core/paragraph' ) {
			settings.attributes.placeholder.default = __(
				'Type / to choose a block, or *| to add a merge tag',
				'newspack-newsletters'
			);
		}
		return settings;
	};

	wp.hooks.addFilter(
		'blocks.registerBlockType',
		'newspack-newsletters/autocompleters/mailchimp-merge-tags-placeholder',
		updateParagraphPlaceholder
	);

	const appendCompleters = ( completers, blockName ) => {
		return blockName === 'core/paragraph' ? [ ...completers, completer ] : completers;
	};

	wp.hooks.addFilter(
		'editor.Autocomplete.completers',
		'newspack-newsletters/autocompleters/mailchimp-merge-tags',
		appendCompleters
	);
};

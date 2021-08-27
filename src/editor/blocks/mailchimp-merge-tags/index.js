import { __ } from '@wordpress/i18n';

import './style.scss';

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
	},
	{
		tag: '*|LNAME|*',
		label: __(
			"Inserts your subscriber's last name if it's available in your audience.",
			'newspack-newsletters'
		),
	},
	{
		tag: '*|TWITTER:PROFILE|*',
		label: __(
			"Populates your campaign with your Twitter avatar, follower, tweet, and following counts; and a follow link. Doesn't include your latest tweets.",
			'newspack-newsletters'
		),
	},
];

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
	getOptionKeywords: ( { tag } ) => [ tag ],
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

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getServiceProvider } from '../../../service-providers';
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
		tag: '*|CAMPAIGN_UID|*',
		label: __( 'Displays the unique ID for your campaign.', 'newspack-newsletters' ),
	},
	{
		tag: '*|REWARDS|*',
		label: __( 'Adds the Referral badge to your campaign.', 'newspack-newsletters' ),
	},
	{
		tag: '*|REWARDS_TEXT|*',
		label: __( 'Adds a text-only version of the Rewards link.', 'newspack-newsletters' ),
	},
	{
		tag: '*|MC:TRANSLATE|*',
		label: __(
			'Inserts links to translate your sent campaign into different languages.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|TRANSLATE:xx|*',
		label: __(
			"Adds a list of links to translate the content in your campaign. Replace xx with the code for the language your campaign is written in, and we'll display other available languages.",
			'newspack-newsletters'
		),
	},
	{
		tag: '*|MC_LANGUAGE|*',
		label: __(
			"Displays the language code for a particular subscriber. For example, if your subscriber's language is set to English, the merge tag output will display the code en.",
			'newspack-newsletters'
		),
	},
	{
		tag: '*|MC_LANGUAGE_LABEL|*',
		label: __(
			'Displays the plain-text language for a particular subscriber. All languages are written English, so if your subscriber\'s language is set to German we\'ll display "German" instead of Deutsch.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|DATE:X|*',
		label: __(
			'Use to show the current date in a given format. Replace X with the format of your choice.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|LIST:RECENTX|*',
		label: __(
			'Displays a list of links to recent campaigns sent to the audience indicated. Replace X with the number of campaigns to show.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|MC:TOC|*',
		label: __( 'Creates a linked table of contents in your campaign.', 'newspack-newsletters' ),
	},
	{
		tag: '*|MC:TOC_TEXT|*',
		label: __(
			'Creates a table of contents in your campaigns as plain-text.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|MC_PREVIEW_TEXT|*',
		label: __(
			'Use this merge tag to generate preview text in a custom-coded campaign.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|POLL:RATING:x|* *|END:POLL|*',
		label: __( 'Creates a poll to record subscriber ratings of 1-10.', 'newspack-newsletters' ),
	},
	{
		tag: '*|SURVEY|* *|END:|*',
		label: __(
			'Creates a one-question survey with a set number of responses that subscribers can choose from.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|PROMO_CODE:[$store_id=x, $rule_id=x, $code_id=x]|*',
		label: __(
			'Use this tag to include a promo code in a campaign. Replace the “x” variables in your Promo Code merge tag to specify what promo code to display.',
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
		tag: '*|EMAIL|*',
		label: __( "Inserts your subscriber's email address.", 'newspack-newsletters' ),
	},
	{
		tag: '*|PHONE|*',
		label: __(
			'Inserts your subscriber’s phone number if it’s available in your audience.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|ADDRESS|*',
		label: __(
			'Inserts your subscriber’s address if it’s available in your audience.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|LIST:NAME|*',
		label: __( 'Inserts the name of your audience.', 'newspack-newsletters' ),
	},
	{
		tag: '*|LIST:COMPANY|*',
		label: __(
			"Inserts the name of your company or organization that's listed in the required email footer content for your audience.",
			'newspack-newsletters'
		),
	},
	{
		tag: '*|LIST:SUBSCRIBERS|*',
		label: __(
			'Inserts the number of subscribers in your audience in plain-text.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|USER:COMPANY|*',
		label: __(
			'Inserts the company or organization name listed under Primary Account Contact info in your Mailchimp account.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|MC:DATE|*',
		label: __(
			'Displays MM/DD/YYYY or DD/MM/YYYY based on your settings in your account Details.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|CURRENT_YEAR|*',
		label: __(
			'Displays the current year. This is great if you include a copyright date in your campaign, because it will update automatically every year.',
			'newspack-newsletters'
		),
	},
	{
		tag: '*|UNSUB|*',
		label: __(
			"Gives your subscribers the opportunity to unsubscribe from your emails. (Required by law and Mailchimp's Terms of Use.).",
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

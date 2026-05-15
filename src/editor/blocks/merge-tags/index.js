/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import registerAutocompleter from './autocompleter';
import registerToolbarButton from './toolbar-button';
import { getLabel, getStaticTags, getTriggerPrefix } from './utils';
import './style.scss';

export default () => {
	const tags = getStaticTags();
	if ( ! tags.length ) {
		return;
	}

	const label = getLabel();
	const triggerPrefix = getTriggerPrefix();

	const updateParagraphPlaceholder = ( settings, name ) => {
		if ( name === 'core/paragraph' ) {
			settings.attributes.placeholder.default = sprintf(
				/* translators: 1: trigger prefix (e.g. "*|" or "*%"), 2: ESP-native singular noun (e.g. "merge tag" or "personalization tag"). */
				__( 'Type / to choose a block, or %1$s to add a %2$s', 'newspack-newsletters' ),
				triggerPrefix,
				label
			);
		}
		return settings;
	};

	addFilter( 'blocks.registerBlockType', 'newspack-newsletters/merge-tags-placeholder', updateParagraphPlaceholder );
	registerAutocompleter();
	registerToolbarButton();
};

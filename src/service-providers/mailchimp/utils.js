/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Get select options for Mailchimp interest groups, arranged by category.
 * Groups are subsets of a list.
 *
 * @param {Object} interestCategories Interest categories object.
 * @return {Array} Array of select options.
 */
export const getGroupOptions = interestCategories => {
	if ( ! interestCategories?.categories || ! interestCategories.categories.length ) {
		return [];
	}
	const options = interestCategories.categories.reduce( ( accumulator, item ) => {
		const { title, interests, id } = item;
		if ( interests?.interests?.length ) {
			const optGroup = {
				// Translators: %s is the name of the interest category.
				label: sprintf( __( 'Interest Category: %s', 'newspack-newsletters' ), title ),
				options: [],
			};
			interests.interests.forEach( interest => {
				const subscriberCount = parseInt( interest.subscriber_count );
				const subscriberCountInfo = sprintf(
					// Translators: subscriber count help message.
					_n( '%d subscriber', '%d subscribers', subscriberCount, 'newspack-newsletters' ),
					subscriberCount
				);

				optGroup.options.push( {
					label: `${ interest.name }${
						interest.local_name ? ' [' + interest.local_name + ']' : ''
					} (${ subscriberCountInfo })`,
					value: `interests-${ id }:${ interest.id }`,
				} );
			} );
			accumulator.push( optGroup );
		}
		return accumulator;
	}, [] );

	return options;
};

/**
 * Get select options for Mailchimp segments or tags.
 * Segments and tags have the same data structure when fetched via the /segments endpoint.
 * See: https://mailchimp.com/developer/marketing/api/list-segments/list-segments/
 *
 * @param {Array} segments Array of segments or tags.
 * @return {Array} Array of select options.
 */
export const getSegmentOptions = segments => {
	if ( ! segments || ! segments.length ) {
		return [];
	}
	return segments.map( segment => ( {
		label: `${ segment.name }${
			segment.local_name ? ' [' + segment.local_name + ']' : ''
		} (${ sprintf(
			// Translators: %d is the number of subscribers in the segment.
			_n( '%d subscriber', '%d subscribers', segment?.member_count || 0, 'newspack-newsletters' ),
			segment?.member_count || 0
		) })`,
		value: segment.id.toString(),
	} ) );
};

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getSuggestionLabel } from '../../newsletter-editor/utils';

/**
 * Get a label describing the audience or subaudience for the autocomplete UI.
 *
 * @param {Object} item The audience or subaudience object.
 * @param {string} type The type of audience or subgroup.
 * @return {string} The formatted label.
 */
export const getSendToLabel = ( item, type = 'audience' ) => {
	const contactCount = item?.member_count || item?.subscriber_count || item?.stats?.member_count;
	return sprintf(
		// Translators: %1$s is the type of audience or subgroup, %2$s is the name of the audience or subgroup, %3$s is the number of contacts in the audience or subgroup.
		__( '[%1$s] %2$s %3$s', 'newspack-newsletters' ),
		type.toUpperCase(),
		item.name || item.title,
		contactCount
			? sprintf(
					// Translators: The number of contacts in the audience or subgroup.
					_n( '(%d contact)', '(%d contacts)', contactCount, 'newspack-newsletters' ),
					contactCount
			  )
			: ''
	).trim();
};

/**
 * Get a link to manage the audience or subaudience in the ESP.
 *
 * @param {Object} item The audience or subaudience object.
 * @return {Object} JSX element.
 */
export const getSendToLink = item => {
	const { web_id: webId } = item;
	if ( webId ) {
		return `https://admin.mailchimp.com/lists/members/?id=${ webId }`;
	}
	return null;
};

/**
 * Get the subaudience options for the autocomplete UI.
 *
 * @param {Object} newsletterData Newsletter campaign data.
 * @return {Array} Array of subaudience options.
 */
export const getSubAudienceOptions = newsletterData => {
	const groups = ( newsletterData?.interest_categories?.categories || [] ).reduce(
		( accumulator, item ) => {
			const { interests, id } = item;
			if ( interests?.interests?.length ) {
				interests.interests.forEach( interest => {
					accumulator.push( {
						...interest,
						value: `interests-${ id }:${ interest.id }`,
						type: 'group',
						typeLabel: __( 'Group', 'newspack-newsletters' ),
					} );
				} );
			}
			return accumulator;
		},
		[]
	);
	const segments = ( newsletterData?.segments || [] ).map( item => ( {
		...item,
		value: item.id,
		type: 'segment',
		typeLabel: __( 'Segment', 'newspack-newsletters' ),
	} ) );
	const tags = ( newsletterData?.tags || [] ).map( item => ( {
		...item,
		value: item.id,
		type: 'tag',
		typeLabel: __( 'Tag', 'newspack-newsletters' ),
	} ) );

	const formattedItems = [ ...groups, ...segments, ...tags ].map( item => ( {
		...item,
	} ) );

	return formattedItems.map( item => {
		const contactCount = item?.member_count || item?.subscriber_count || item?.stats?.member_count;
		if ( contactCount ) {
			item.details = sprintf(
				// Translators: %d is the number of contacts in the list.
				_n( '%d contact', '%d contacts', contactCount, 'newspack-newsletters' ),
				contactCount.toLocaleString()
			);
		}

		item.name = item.name || item.title;
		item.label = getSuggestionLabel( item );

		return item;
	} );
};

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getSuggestionLabel } from '../../newsletter-editor/utils';

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
		const contactCount = parseInt(
			item?.member_count || item?.subscriber_count || item?.stats?.member_count
		);
		if ( ! isNaN( contactCount ) ) {
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

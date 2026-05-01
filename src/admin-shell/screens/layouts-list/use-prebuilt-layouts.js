/**
 * One-shot fetch of prebuilt layouts.
 *
 * Prebuilt layouts are seeded by code from JSON files in
 * `includes/layouts/` (see `Newspack_Newsletters_Layouts::get_default_layouts`).
 * They aren't WP posts and the standard `/wp/v2/<cpt>` collection
 * doesn't surface them; the bespoke `/newspack-newsletters/v1/layouts`
 * endpoint returns them alongside saved layouts. We filter to prebuilts
 * here (saved layouts are handled by `useLayoutsData`) and normalise
 * the legacy `{ ID, post_title, post_content }` shape into the
 * REST-shaped objects the DataView already understands.
 *
 * `is_prebuilt: true` tags the resulting items so action eligibility
 * (`isEligible: item => ! item.is_prebuilt`) can disable Edit / Rename
 * / Delete on locked rows. Synthetic IDs are prefixed `prebuilt-` to
 * avoid colliding with real post IDs.
 */

import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';

export default function usePrebuiltLayouts() {
	const [ layouts, setLayouts ] = useState( [] );

	useEffect( () => {
		let cancelled = false;
		// `defaults_only=1` so the endpoint skips the saved-layouts
		// WP_Query — without it the response carries every saved post
		// just for us to filter them out client-side.
		apiFetch( { path: '/newspack-newsletters/v1/layouts?defaults_only=1' } )
			.then( items => {
				if ( cancelled || ! Array.isArray( items ) ) {
					return;
				}
				// `post_author` is the canonical "is this a real post"
				// signal — `Newspack_Newsletters_Layouts::get_layouts`
				// merges WP_Post objects (which carry post_author) with
				// plain arrays from the JSON files (which don't). The
				// filter is still applied client-side as a safety net
				// in case the server param is unsupported on older
				// builds.
				const prebuilts = items
					.filter( item => item && item.post_author === undefined )
					.map( ( item, idx ) => {
						const fallbackTitle = sprintf(
							/* translators: %d: 1-based prebuilt index. */
							__( 'Prebuilt %d', 'newspack-newsletters' ),
							idx + 1
						);
						return {
							id: `prebuilt-${ item.ID }`,
							is_prebuilt: true,
							// Mirror the REST shape `useLayoutsData` produces so the
							// DataView fields don't have to branch on item type.
							title: {
								raw: item.post_title || fallbackTitle,
								rendered: item.post_title || fallbackTitle,
							},
							content: {
								raw: item.post_content || '',
								rendered: item.post_content || '',
							},
							modified: null,
							meta: {},
						};
					} );
				setLayouts( prebuilts );
			} )
			.catch( () => {
				// Swallow — prebuilts are auxiliary content. A failure
				// here just means the locked Prebuilt cards don't appear;
				// the saved layouts list remains unaffected.
			} );
		return () => {
			cancelled = true;
		};
	}, [] );

	return layouts;
}

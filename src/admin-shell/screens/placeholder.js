/**
 * Placeholder screen used by the admin shell while the real
 * surfaces are built out in NEWS-1928 to NEWS-1931.
 *
 * The page label is already rendered as the chrome's `h1` in `App`;
 * the placeholder only adds body copy.
 *
 * For Settings specifically, link through to the classic settings
 * page so ESP credentials stay reachable until NEWS-1931 swaps in
 * the React form.
 */

import { __ } from '@wordpress/i18n';

export default function Placeholder() {
	const { classicSettings, currentPage } = window.newspackNewslettersAdmin || {};
	const isSettings = currentPage === 'newspack-newsletters-settings';

	return (
		<div className="newspack-newsletters-admin__placeholder">
			<p>{ __( 'This surface is being rebuilt as part of the Newsletters admin modernisation.', 'newspack-newsletters' ) }</p>
			{ isSettings && classicSettings && (
				<p>
					<a href={ classicSettings }>{ __( 'Open the existing settings page', 'newspack-newsletters' ) }</a>
				</p>
			) }
		</div>
	);
}

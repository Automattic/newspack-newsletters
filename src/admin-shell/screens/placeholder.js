/**
 * Placeholder screen used by the admin shell while the real
 * surfaces are built out in NEWS-1928 to NEWS-1931.
 */

import { __ } from '@wordpress/i18n';

export default function Placeholder( { label } ) {
	return (
		<div className="newspack-newsletters-admin__placeholder">
			<h2>{ label }</h2>
			<p>{ __( 'This surface is being rebuilt as part of the Newsletters admin modernisation.', 'newspack-newsletters' ) }</p>
		</div>
	);
}

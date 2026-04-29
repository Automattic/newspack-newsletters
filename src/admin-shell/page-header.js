/**
 * Chassis page header.
 *
 * Renders the screen title plus the action row populated via
 * `useHeaderActions`. Action shape mirrors `newspack-plugin`'s wizard
 * `setHeaderData` so a future consolidation against the shared component
 * package is mechanical.
 */

import { Button } from '@wordpress/components';
import { useHeaderActionsValue } from './header-actions-context';

const variantFor = type => ( 'primary' === type ? 'primary' : 'secondary' );

export default function PageHeader() {
	const actions = useHeaderActionsValue();

	if ( actions.length === 0 ) {
		return null;
	}

	return (
		<div className="newspack-newsletters-admin__header-actions">
			{ actions.map( ( action, index ) => (
				<Button
					key={ action.id || `${ action.label }-${ index }` }
					variant={ variantFor( action.type ) }
					icon={ action.icon }
					href={ action.href }
					onClick={ action.onClick }
				>
					{ action.label }
				</Button>
			) ) }
		</div>
	);
}

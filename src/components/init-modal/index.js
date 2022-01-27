/**
 * Newsletter Modal
 */

/**
 * WordPress dependencies
 */
import { Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import LayoutPicker from './screens/layout-picker';
import APIKeys from './screens/api-keys';
import './style.scss';

export default ( { shouldDisplaySettings, onSetupStatus } ) => {
	return (
		<Modal
			className="newspack-newsletters-modal__frame"
			isDismissible={ false }
			overlayClassName="newspack-newsletters-modal__screen-overlay"
			shouldCloseOnClickOutside={ false }
			shouldCloseOnEsc={ false }
			title={
				shouldDisplaySettings
					? __( 'Configure Plugin', 'newspack-newsletters' )
					: __( 'Add New Newsletter', 'newspack-newsletters' )
			}
		>
			{ shouldDisplaySettings ? <APIKeys onSetupStatus={ onSetupStatus } /> : <LayoutPicker /> }
		</Modal>
	);
};

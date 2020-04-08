/**
 * Newsletter Modal
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Component, Fragment } from '@wordpress/element';
import { Button, Modal } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './style.scss';

class TemplateModal extends Component {
  render = () => {
    const { closeModal } = this.props;
    return (
      <Modal
				className="newspack-newsletters-modal__frame"
				isDismissible={ false }
				onRequestClose={ closeModal }
				overlayClassName="newspack-newsletters-modal__screen-overlay"
				shouldCloseOnClickOutside={ false }
				shouldCloseOnEsc={ false }
				title={ __( 'Select a layout', 'newspack-newsletters' ) }
      >
				<div className="newspack-newsletters-modal__content">
					<p>{ __( 'Layout selector with preview will go here.', 'newspack-newsletters' ) }</p>
				</div>
				<Button isPrimary onClick={ closeModal }>
					{ __( 'Use CURRENTLAYOUT layout', 'newspack-newsletters' ) }
				</Button>
			</Modal>
    );
  };
}

export default TemplateModal;

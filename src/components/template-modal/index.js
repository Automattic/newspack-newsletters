/**
 * Newsletter Modal
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Component, Fragment } from '@wordpress/element';
import { Modal, TabPanel } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './style.scss';

class TemplateModal extends Component {
  render = () => {
    const { closeModal } = this.props;
    return (
      <Modal
        title={ __( 'Newsletter Layouts', 'newspack-newsletters' ) }
        onRequestClose={ closeModal }
        className="newspack-newsletters_newsletter-modal"
      />
    );
  };
}

export default TemplateModal;
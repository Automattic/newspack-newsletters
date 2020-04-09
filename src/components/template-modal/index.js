/**
 * Newsletter Modal
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Component } from '@wordpress/element';
import { Button, Modal } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './style.scss';

class TemplateModal extends Component {
	render = () => {
		const {
			closeModal,
			onInsertTemplate,
			onSelectTemplate,
			selectedTemplate,
			templates,
		} = this.props;
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
					{ ( templates || [] ).map( ( { title, image }, index ) => (
						<button
							key={ index }
							className={ selectedTemplate === index ? 'selected' : null }
							onClick={ () => onSelectTemplate( index ) }
						>
							<h2>{ title }</h2>
							<img src={ image } alt={ title } />
						</button>
					) ) }
				</div>
				{ selectedTemplate !== null && (
					<Button isPrimary onClick={ () => onInsertTemplate( selectedTemplate ) }>
						{ sprintf(
							__( 'Use %s layout', 'newspack-newsletter' ),
							templates[ selectedTemplate ].title
						) }
					</Button>
				) }
			</Modal>
		);
	};
}

export default TemplateModal;

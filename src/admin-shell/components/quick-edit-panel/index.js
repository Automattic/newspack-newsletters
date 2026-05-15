/**
 * Side-mounted Quick Edit panel — mirrors Core's
 * `dataviews-action-modal__quick-edit` from the Site Editor's Pages
 * route. Standard `<Modal>` anchored to the right edge via overlay
 * styles, with a sticky footer for Cancel / Save.
 */

import {
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalTruncate as Truncate, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	Button,
	Icon,
	Modal,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { close } from '@wordpress/icons';

export default function QuickEditPanel( {
	title,
	icon,
	subjectTitle,
	onClose,
	onSave,
	isBusy = false,
	canSave = true,
	saveLabel,
	className,
	children,
} ) {
	const handleSubmit = event => {
		event.preventDefault();
		if ( isBusy || ! canSave ) {
			return;
		}
		onSave();
	};

	const frameClassName = [ 'newspack-newsletters-quick-edit-modal', className ].filter( Boolean ).join( ' ' );

	return (
		<Modal
			title={ title }
			contentLabel={ title }
			__experimentalHideHeader
			onRequestClose={ isBusy ? () => {} : onClose }
			shouldCloseOnEsc={ ! isBusy }
			// Suppress click-outside dismiss: the side-anchored layout makes
			// "outside" a large target and an accidental click during edit
			// would silently drop unsaved field changes.
			shouldCloseOnClickOutside={ false }
			className={ frameClassName }
			overlayClassName="newspack-newsletters-quick-edit-modal__overlay"
		>
			<HStack className="newspack-newsletters-quick-edit-modal__header" spacing={ 2 } alignment="center">
				{ icon && <Icon className="newspack-newsletters-quick-edit-modal__icon" icon={ icon } size={ 24 } /> }
				<h2 className="newspack-newsletters-quick-edit-modal__title">
					<Truncate>{ subjectTitle || title }</Truncate>
				</h2>
				<Button
					className="newspack-newsletters-quick-edit-modal__close"
					icon={ close }
					size="small"
					label={ __( 'Close', 'newspack-newsletters' ) }
					onClick={ onClose }
					disabled={ isBusy }
				/>
			</HStack>
			<form className="newspack-newsletters-quick-edit-modal__form" onSubmit={ handleSubmit }>
				<div className="newspack-newsletters-quick-edit-modal__content">
					<VStack spacing={ 4 }>{ children }</VStack>
				</div>
				<HStack className="newspack-newsletters-quick-edit-modal__footer" justify="flex-end" spacing={ 2 }>
					<Button variant="secondary" onClick={ onClose } disabled={ isBusy }>
						{ __( 'Cancel', 'newspack-newsletters' ) }
					</Button>
					<Button variant="primary" type="submit" isBusy={ isBusy } disabled={ isBusy || ! canSave }>
						{ saveLabel || __( 'Save', 'newspack-newsletters' ) }
					</Button>
				</HStack>
			</form>
		</Modal>
	);
}

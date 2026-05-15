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
import { useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { close } from '@wordpress/icons';

export default function QuickEditPanel( {
	title,
	icon,
	subjectTitle,
	isDirty = false,
	onClose,
	onSave,
	isBusy = false,
	canSave = true,
	saveLabel,
	className,
	children,
} ) {
	// Route X / Cancel through Modal's exit cycle by dispatching a
	// synthetic Escape on the overlay. Modal's `handleEscapeKeyDown`
	// runs `closeModal()` first, which adds `.is-animating-out` and
	// waits for the slide-out animation before invoking `onRequestClose`.
	// Calling `onClose` directly would unmount before the animation
	// has a chance to play.
	const requestClose = useCallback( () => {
		if ( isBusy ) {
			return;
		}
		const overlay = document.querySelector( '.newspack-newsletters-quick-edit-modal__overlay' );
		if ( overlay ) {
			overlay.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', code: 'Escape', bubbles: true } ) );
		} else {
			onClose();
		}
	}, [ isBusy, onClose ] );

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
			contentLabel={ subjectTitle ? `${ title }: ${ subjectTitle }` : title }
			__experimentalHideHeader
			onRequestClose={ isBusy ? () => {} : onClose }
			shouldCloseOnEsc={ ! isBusy }
			// Block click-outside dismissal while the form is dirty so
			// unsaved edits aren't silently dropped by a stray click.
			shouldCloseOnClickOutside={ ! isBusy && ! isDirty }
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
					onClick={ requestClose }
					disabled={ isBusy }
				/>
			</HStack>
			<form className="newspack-newsletters-quick-edit-modal__form" onSubmit={ handleSubmit }>
				<div className="newspack-newsletters-quick-edit-modal__content">
					<VStack spacing={ 4 }>{ children }</VStack>
				</div>
				<HStack className="newspack-newsletters-quick-edit-modal__footer" justify="flex-end" spacing={ 2 }>
					<Button variant="secondary" onClick={ requestClose } disabled={ isBusy }>
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

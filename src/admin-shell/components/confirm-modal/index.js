import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * @param {Object}                                       props
 * @param {Array<Object>}                                props.items           Items DataViews passed into the action.
 * @param {() => void}                                   props.closeModal      Close handler supplied by DataViews.
 * @param {string}                                       props.confirmLabel    Label for the confirm button at rest.
 * @param {string}                                       props.confirmingLabel Label shown while the confirm action is in flight.
 * @param {string|import('react').ReactNode}             props.question        Body content rendered above the buttons.
 * @param {boolean}                                      [props.isDestructive] Apply destructive styling to the confirm button.
 * @param {( items: Array<Object> ) => Promise<unknown>} props.onConfirm       Async handler invoked with `items`.
 * @return {import('react').ReactElement} Modal body element.
 */
export default function ConfirmModal( { items, closeModal, confirmLabel, confirmingLabel, question, isDestructive, onConfirm } ) {
	const [ isBusy, setIsBusy ] = useState( false );
	return (
		<div>
			<p>{ question }</p>
			<div style={ { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }>
				<Button variant="tertiary" onClick={ closeModal } disabled={ isBusy }>
					{ __( 'Cancel', 'newspack-newsletters' ) }
				</Button>
				<Button
					variant="primary"
					isDestructive={ isDestructive }
					isBusy={ isBusy }
					disabled={ isBusy }
					onClick={ async () => {
						setIsBusy( true );
						try {
							await onConfirm( items );
							closeModal();
						} catch ( error ) {
							setIsBusy( false );
						}
					} }
				>
					{ isBusy ? confirmingLabel : confirmLabel }
				</Button>
			</div>
		</div>
	);
}

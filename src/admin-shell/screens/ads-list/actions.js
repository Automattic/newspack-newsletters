/**
 * Per-row + bulk actions for the Ads list.
 *
 * The ads CPT has no `transition_post_status` ESP-send hazard (the
 * service-provider hook short-circuits on the newsletter CPT only), so
 * destructive lifecycle actions like Trash / Restore / Delete are safe.
 * Activation/deactivation is date-driven — there's no equivalent of the
 * newsletters list's `Make public` toggles.
 */

import apiFetch from '@wordpress/api-fetch';
import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import { getAdminUrl } from '../../admin-globals';
import { notifyError, notifySuccess } from '../../notices';
import { isTrashed } from './status-label';

const POSTS_PATH = '/wp/v2/newspack_nl_ads_cpt';

const trashOne = id => apiFetch( { path: `${ POSTS_PATH }/${ id }`, method: 'DELETE' } );

// Restoring an ad updates the post status back to `draft` via POST
// (the WP REST posts update verb). Unlike newsletters, ads have no
// controlled-status logic in `insert_post_data`, so the row stays as
// draft until the publisher edits and publishes it again. That's the
// intended behaviour for the ads lifecycle (date-driven activation).
const restoreOne = id =>
	apiFetch( {
		path: `${ POSTS_PATH }/${ id }`,
		method: 'POST',
		data: { status: 'draft' },
	} );

const deleteOne = id => apiFetch( { path: `${ POSTS_PATH }/${ id }?force=true`, method: 'DELETE' } );

function ConfirmModal( { items, closeModal, confirmLabel, confirmingLabel, question, isDestructive, onConfirm } ) {
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

export function getActions( { refresh, openQuickEdit } ) {
	const editAction = {
		id: 'edit',
		label: __( 'Edit', 'newspack-newsletters' ),
		isPrimary: true,
		callback: items => {
			const item = items[ 0 ];
			if ( ! item ) {
				return;
			}
			window.location.href = `${ getAdminUrl() }post.php?post=${ item.id }&action=edit`;
		},
	};

	const quickEditAction = {
		id: 'quick-edit',
		label: __( 'Quick edit', 'newspack-newsletters' ),
		isEligible: item => ! isTrashed( item ),
		callback: items => {
			const item = items[ 0 ];
			if ( ! item || typeof openQuickEdit !== 'function' ) {
				return;
			}
			openQuickEdit( item );
		},
	};

	const trashAction = {
		id: 'trash',
		label: __( 'Move to trash', 'newspack-newsletters' ),
		isDestructive: true,
		supportsBulk: true,
		isEligible: item => ! isTrashed( item ),
		RenderModal: ( { items, closeModal } ) => (
			<ConfirmModal
				items={ items }
				closeModal={ closeModal }
				confirmLabel={ __( 'Move to trash', 'newspack-newsletters' ) }
				confirmingLabel={ __( 'Moving…', 'newspack-newsletters' ) }
				question={ sprintf(
					/* translators: %d: number of ads */
					_n(
						'Move %d ad to the trash? You can restore it from the Trash filter later.',
						'Move %d ads to the trash? You can restore them from the Trash filter later.',
						items.length,
						'newspack-newsletters'
					),
					items.length
				) }
				isDestructive
				onConfirm={ async list => {
					const failed = [];
					await Promise.all(
						list.map( item =>
							trashOne( item.id ).catch( () => {
								failed.push( item );
							} )
						)
					);
					refresh();
					if ( failed.length === 0 ) {
						notifySuccess( _n( 'Ad moved to trash.', 'Ads moved to trash.', list.length, 'newspack-newsletters' ) );
					} else {
						notifyError(
							sprintf(
								/* translators: %d: number that failed */
								__( 'Failed to trash %d ad(s). Please try again.', 'newspack-newsletters' ),
								failed.length
							)
						);
					}
				} }
			/>
		),
	};

	const restoreAction = {
		id: 'restore',
		label: __( 'Restore', 'newspack-newsletters' ),
		supportsBulk: true,
		isEligible: isTrashed,
		callback: async items => {
			const eligible = items.filter( isTrashed );
			if ( eligible.length === 0 ) {
				return;
			}
			const failed = [];
			await Promise.all(
				eligible.map( item =>
					restoreOne( item.id ).catch( () => {
						failed.push( item );
					} )
				)
			);
			refresh();
			if ( failed.length === 0 ) {
				notifySuccess( _n( 'Ad restored.', 'Ads restored.', eligible.length, 'newspack-newsletters' ) );
			} else {
				notifyError(
					sprintf(
						/* translators: %d: number that failed */
						__( 'Failed to restore %d ad(s).', 'newspack-newsletters' ),
						failed.length
					)
				);
			}
		},
	};

	const deleteAction = {
		id: 'delete-permanently',
		label: __( 'Delete permanently', 'newspack-newsletters' ),
		isDestructive: true,
		supportsBulk: true,
		isEligible: isTrashed,
		RenderModal: ( { items, closeModal } ) => (
			<ConfirmModal
				items={ items }
				closeModal={ closeModal }
				confirmLabel={ __( 'Delete permanently', 'newspack-newsletters' ) }
				confirmingLabel={ __( 'Deleting…', 'newspack-newsletters' ) }
				question={ sprintf(
					/* translators: %d: number of ads */
					_n(
						'Permanently delete %d ad? This cannot be undone.',
						'Permanently delete %d ads? This cannot be undone.',
						items.length,
						'newspack-newsletters'
					),
					items.length
				) }
				isDestructive
				onConfirm={ async list => {
					const failed = [];
					await Promise.all(
						list.map( item =>
							deleteOne( item.id ).catch( () => {
								failed.push( item );
							} )
						)
					);
					refresh();
					if ( failed.length === 0 ) {
						notifySuccess( _n( 'Ad deleted.', 'Ads deleted.', list.length, 'newspack-newsletters' ) );
					} else {
						notifyError(
							sprintf(
								/* translators: %d: number that failed */
								__( 'Failed to delete %d ad(s).', 'newspack-newsletters' ),
								failed.length
							)
						);
					}
				} }
			/>
		),
	};

	return [ editAction, quickEditAction, trashAction, restoreAction, deleteAction ];
}

/**
 * Per-row + bulk actions for the Advertisers list.
 *
 * Edit opens the Add/Edit Modal (no separate edit screen); Delete
 * confirms then calls `DELETE /wp/v2/<taxonomy>/<id>?force=true` (the
 * REST taxonomy endpoint requires `force=true` because terms cannot be
 * trashed — they're either present or absent). Bulk Delete batches the
 * same single-term delete in parallel.
 */

import apiFetch from '@wordpress/api-fetch';
import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import { notifyError, notifySuccess } from '../../notices';

const TAXONOMY_PATH = '/wp/v2/newspack_nl_advertiser';

const deleteOne = id => apiFetch( { path: `${ TAXONOMY_PATH }/${ id }?force=true`, method: 'DELETE' } );

function ConfirmDeleteModal( { items, closeModal, onConfirm } ) {
	const [ isBusy, setIsBusy ] = useState( false );
	const question = sprintf(
		/* translators: %d: number of advertisers */
		_n(
			'Permanently delete %d advertiser? Ads referencing it will lose the assignment. This cannot be undone.',
			'Permanently delete %d advertisers? Ads referencing them will lose the assignment. This cannot be undone.',
			items.length,
			'newspack-newsletters'
		),
		items.length
	);

	return (
		<div>
			<p>{ question }</p>
			<div style={ { display: 'flex', gap: '8px', justifyContent: 'flex-end' } }>
				<Button variant="tertiary" onClick={ closeModal } disabled={ isBusy }>
					{ __( 'Cancel', 'newspack-newsletters' ) }
				</Button>
				<Button
					variant="primary"
					isDestructive
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
					{ isBusy ? __( 'Deleting…', 'newspack-newsletters' ) : __( 'Delete permanently', 'newspack-newsletters' ) }
				</Button>
			</div>
		</div>
	);
}

export function getActions( { onEdit, onMutated } ) {
	const editAction = {
		id: 'edit',
		label: __( 'Edit', 'newspack-newsletters' ),
		isPrimary: true,
		callback: items => {
			const item = items[ 0 ];
			if ( ! item ) {
				return;
			}
			onEdit( item );
		},
	};

	const deleteAction = {
		id: 'delete-permanently',
		label: __( 'Delete', 'newspack-newsletters' ),
		isDestructive: true,
		supportsBulk: true,
		RenderModal: ( { items, closeModal } ) => (
			<ConfirmDeleteModal
				items={ items }
				closeModal={ closeModal }
				onConfirm={ async list => {
					const failed = [];
					await Promise.all(
						list.map( item =>
							deleteOne( item.id ).catch( () => {
								failed.push( item );
							} )
						)
					);
					// `onMutated` refetches both the paginated list and
					// the all-advertisers cache that powers the parent
					// picker — without the second refetch, a deleted
					// term would linger in the modal's TreeSelect and
					// fail server-side if picked as a parent.
					onMutated();
					if ( failed.length === 0 ) {
						notifySuccess( _n( 'Advertiser deleted.', 'Advertisers deleted.', list.length, 'newspack-newsletters' ) );
					} else {
						notifyError(
							sprintf(
								/* translators: %d: number that failed */
								__( 'Failed to delete %d advertiser(s). Please try again.', 'newspack-newsletters' ),
								failed.length
							)
						);
					}
				} }
			/>
		),
	};

	return [ editAction, deleteAction ];
}

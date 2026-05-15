/**
 * Per-row + bulk actions for the Newsletters list.
 *
 * Status transitions are deliberately limited: only Trash, Restore, and
 * Permanently delete are exposed. The base service-provider class
 * triggers an ESP campaign send on `transition_post_status` to publish
 * or private — bulk publishing newsletters here would dispatch
 * irreversibly. Editing post status remains the editor's job.
 */

import apiFetch from '@wordpress/api-fetch';
import { Button } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { edit, trash } from '@wordpress/icons';

import { getAdminUrl } from '../../admin-globals';
import RenameForm from '../../components/rename-form';
import { notifyError, notifySuccess } from '../../notices';
import { isTrashed } from './status-label';

const POSTS_PATH = '/wp/v2/newspack_nl_cpt';

const trashOne = id => apiFetch( { path: `${ POSTS_PATH }/${ id }`, method: 'DELETE' } );

// PATCH `status: 'draft'` for every restore — the actual landing
// status depends on whether the newsletter has already been sent:
//
//   - Never-sent: `Newspack_Newsletters_Service_Provider::insert_post_data`
//     leaves `draft` alone, so the row restores as a draft.
//   - Already-sent: the same filter forces the row back to its
//     controlled status (`publish` if `is_public`, otherwise `private`)
//     so a sent newsletter cannot accidentally land in draft.
//
// Both branches are safe vs the ESP-send guard: the provider's send
// only fires when transitioning INTO publish/private from a non-sent
// state, and `is_newsletter_sent()` short-circuits the second case.
// We expose this as plain "Restore" — naming it "Restore as draft"
// would mislead users because that's only true for never-sent rows.
const restoreOne = id =>
	apiFetch( {
		path: `${ POSTS_PATH }/${ id }`,
		method: 'POST',
		data: { status: 'draft' },
	} );

const deleteOne = id => apiFetch( { path: `${ POSTS_PATH }/${ id }?force=true`, method: 'DELETE' } );

// Toggling `is_public` on a `publish`/`private` newsletter goes
// through `Newspack_Newsletters_Service_Provider::updated_post_meta`,
// which calls `wp_update_post` and **does** fire
// `transition_post_status` (between `publish` and `private`). Toggling
// it on a draft leaves the status alone entirely. Either way the
// provider's send guard sees `is_newsletter_sent()` truthy on
// already-published rows and skips dispatch — so this action is safe
// from re-sending campaigns, but it is *not* purely meta-only.
const setIsPublic = ( id, isPublic ) =>
	apiFetch( {
		path: `${ POSTS_PATH }/${ id }`,
		method: 'POST',
		data: { meta: { is_public: !! isPublic } },
	} );

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

// Eligibility predicates extracted to constants so each non-modal bulk
// callback can re-apply them to the selection. DataViews only filters
// by `isEligible` automatically for **modal** bulk actions; plain
// callback bulk actions get the full selected set, so without this
// guard a user who selected a trashed + scheduled row would unschedule
// the latter when they hit "Restore".
const isMakePublicEligible = item => ! isTrashed( item ) && ! item?.meta?.is_public;
const isMakeNonPublicEligible = item => ! isTrashed( item ) && !! item?.meta?.is_public;

export function getActions( { refresh, openQuickEdit } ) {
	const editAction = {
		id: 'edit',
		label: __( 'Edit', 'newspack-newsletters' ),
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
		label: __( 'Quick Edit', 'newspack-newsletters' ),
		isPrimary: true,
		icon: edit,
		isEligible: item => ! isTrashed( item ),
		callback: items => {
			const item = items[ 0 ];
			if ( ! item || typeof openQuickEdit !== 'function' ) {
				return;
			}
			openQuickEdit( item );
		},
	};

	const renameAction = {
		id: 'rename',
		label: __( 'Rename', 'newspack-newsletters' ),
		modalHeader: __( 'Rename', 'newspack-newsletters' ),
		modalSize: 'medium',
		isEligible: item => ! isTrashed( item ),
		RenderModal: ( { items, closeModal } ) => (
			<RenameForm
				item={ items[ 0 ] }
				postPath={ POSTS_PATH }
				fieldLabel={ __( 'Subject', 'newspack-newsletters' ) }
				savedMessage={ __( 'Newsletter renamed.', 'newspack-newsletters' ) }
				closeModal={ closeModal }
				onSaved={ refresh }
			/>
		),
	};

	const viewAction = {
		id: 'view-public-page',
		label: __( 'View public page', 'newspack-newsletters' ),
		// `is_public` and a REST `link` are not enough — drafts/scheduled/
		// private rows can carry both but have no live public-facing page.
		// Only `publish` posts are publicly viewable; private rows are
		// admin-only even with `is_public` momentarily out of sync.
		isEligible: item => 'publish' === item?.status && !! item?.link,
		callback: items => {
			const item = items[ 0 ];
			if ( item?.link ) {
				window.open( item.link, '_blank', 'noopener' );
			}
		},
	};

	const makePublicAction = {
		id: 'make-public',
		label: __( 'Set visibility to Email and web', 'newspack-newsletters' ),
		supportsBulk: true,
		// Hide on already-public rows and on trashed rows; nothing to do
		// in the first case, dangerous-feeling in the second.
		isEligible: isMakePublicEligible,
		callback: async items => {
			const eligible = items.filter( isMakePublicEligible );
			if ( eligible.length === 0 ) {
				return;
			}
			const failed = [];
			await Promise.all(
				eligible.map( item =>
					setIsPublic( item.id, true ).catch( () => {
						failed.push( item );
					} )
				)
			);
			refresh();
			if ( failed.length === 0 ) {
				notifySuccess(
					sprintf(
						/* translators: %d: number of newsletters updated */
						_n(
							'Visibility updated for %d newsletter.',
							'Visibility updated for %d newsletters.',
							eligible.length,
							'newspack-newsletters'
						),
						eligible.length
					)
				);
			} else {
				notifyError(
					sprintf(
						/* translators: %d: number of newsletters that failed */
						_n(
							'Failed to update visibility for %d newsletter.',
							'Failed to update visibility for %d newsletters.',
							failed.length,
							'newspack-newsletters'
						),
						failed.length
					)
				);
			}
		},
	};

	const makeNonPublicAction = {
		id: 'make-non-public',
		label: __( 'Set visibility to Email only', 'newspack-newsletters' ),
		supportsBulk: true,
		isEligible: isMakeNonPublicEligible,
		callback: async items => {
			const eligible = items.filter( isMakeNonPublicEligible );
			if ( eligible.length === 0 ) {
				return;
			}
			const failed = [];
			await Promise.all(
				eligible.map( item =>
					setIsPublic( item.id, false ).catch( () => {
						failed.push( item );
					} )
				)
			);
			refresh();
			if ( failed.length === 0 ) {
				notifySuccess(
					sprintf(
						/* translators: %d: number of newsletters updated */
						_n(
							'Visibility updated for %d newsletter.',
							'Visibility updated for %d newsletters.',
							eligible.length,
							'newspack-newsletters'
						),
						eligible.length
					)
				);
			} else {
				notifyError(
					sprintf(
						/* translators: %d: number of newsletters that failed */
						_n(
							'Failed to update visibility for %d newsletter.',
							'Failed to update visibility for %d newsletters.',
							failed.length,
							'newspack-newsletters'
						),
						failed.length
					)
				);
			}
		},
	};

	const trashAction = {
		id: 'trash',
		label: __( 'Trash', 'newspack-newsletters' ),
		isPrimary: true,
		icon: trash,
		modalHeader: __( 'Move to trash', 'newspack-newsletters' ),
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
					/* translators: %d: number of newsletters */
					_n(
						'Move %d newsletter to the trash? You can restore it from the Trash filter later.',
						'Move %d newsletters to the trash? You can restore them from the Trash filter later.',
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
						notifySuccess( _n( 'Newsletter moved to trash.', 'Newsletters moved to trash.', list.length, 'newspack-newsletters' ) );
					} else {
						notifyError(
							sprintf(
								/* translators: %d: number that failed */
								__( 'Failed to trash %d newsletter(s). Please try again.', 'newspack-newsletters' ),
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
				notifySuccess( _n( 'Newsletter restored.', 'Newsletters restored.', eligible.length, 'newspack-newsletters' ) );
			} else {
				notifyError(
					sprintf(
						/* translators: %d: number that failed */
						__( 'Failed to restore %d newsletter(s).', 'newspack-newsletters' ),
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
					/* translators: %d: number of newsletters */
					_n(
						'Permanently delete %d newsletter? This cannot be undone.',
						'Permanently delete %d newsletters? This cannot be undone.',
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
						notifySuccess( _n( 'Newsletter deleted.', 'Newsletters deleted.', list.length, 'newspack-newsletters' ) );
					} else {
						notifyError(
							sprintf(
								/* translators: %d: number that failed */
								__( 'Failed to delete %d newsletter(s).', 'newspack-newsletters' ),
								failed.length
							)
						);
					}
				} }
			/>
		),
	};

	return [ quickEditAction, trashAction, makePublicAction, makeNonPublicAction, editAction, renameAction, viewAction, restoreAction, deleteAction ];
}

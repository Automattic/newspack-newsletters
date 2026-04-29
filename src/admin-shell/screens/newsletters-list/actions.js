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
import { dispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import { isTrashed } from './status-label';

const POSTS_PATH = '/wp/v2/newspack_nl_cpt';

function notify( message, type = 'success' ) {
	const noticeApi = dispatch( noticesStore );
	if ( 'error' === type ) {
		noticeApi.createErrorNotice( message );
	} else {
		noticeApi.createSuccessNotice( message );
	}
}

const trashOne = id => apiFetch( { path: `${ POSTS_PATH }/${ id }`, method: 'DELETE' } );

// Always restore to `draft`, not the pre-trash status. WP's default
// untrash flow restores the previous status (e.g. `publish`/`private`),
// which would re-fire `transition_post_status` and dispatch the ESP
// campaign for previously-sent newsletters. The button label makes the
// "as draft" semantics explicit so users aren't surprised.
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

export function getActions( { refresh } ) {
	const editAction = {
		id: 'edit',
		label: __( 'Edit', 'newspack-newsletters' ),
		isPrimary: true,
		callback: items => {
			const item = items[ 0 ];
			if ( ! item ) {
				return;
			}
			window.location.href = `${ window.newspackNewslettersAdmin.adminUrl }post.php?post=${ item.id }&action=edit`;
		},
	};

	const viewAction = {
		id: 'view-public-page',
		label: __( 'View public page', 'newspack-newsletters' ),
		isEligible: item => !! item?.meta?.is_public && !! item?.link && ! isTrashed( item ),
		callback: items => {
			const item = items[ 0 ];
			if ( item?.link ) {
				window.open( item.link, '_blank', 'noopener' );
			}
		},
	};

	const makePublicAction = {
		id: 'make-public',
		label: __( 'Make newsletter pages public', 'newspack-newsletters' ),
		supportsBulk: true,
		// Hide on already-public rows and on trashed rows; nothing to do
		// in the first case, dangerous-feeling in the second.
		isEligible: item => ! isTrashed( item ) && ! item?.meta?.is_public,
		callback: async items => {
			const failed = [];
			await Promise.all(
				items.map( item =>
					setIsPublic( item.id, true ).catch( () => {
						failed.push( item );
					} )
				)
			);
			refresh();
			if ( failed.length === 0 ) {
				notify( _n( 'Newsletter page made public.', 'Newsletter pages made public.', items.length, 'newspack-newsletters' ) );
			} else {
				notify(
					sprintf(
						/* translators: %d: number that failed */
						__( 'Failed to make %d newsletter page(s) public.', 'newspack-newsletters' ),
						failed.length
					),
					'error'
				);
			}
		},
	};

	const makeNonPublicAction = {
		id: 'make-non-public',
		label: __( 'Make newsletter pages non-public', 'newspack-newsletters' ),
		supportsBulk: true,
		isEligible: item => ! isTrashed( item ) && !! item?.meta?.is_public,
		callback: async items => {
			const failed = [];
			await Promise.all(
				items.map( item =>
					setIsPublic( item.id, false ).catch( () => {
						failed.push( item );
					} )
				)
			);
			refresh();
			if ( failed.length === 0 ) {
				notify( _n( 'Newsletter page made non-public.', 'Newsletter pages made non-public.', items.length, 'newspack-newsletters' ) );
			} else {
				notify(
					sprintf(
						/* translators: %d: number that failed */
						__( 'Failed to make %d newsletter page(s) non-public.', 'newspack-newsletters' ),
						failed.length
					),
					'error'
				);
			}
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
						notify( _n( 'Newsletter moved to trash.', 'Newsletters moved to trash.', list.length, 'newspack-newsletters' ) );
					} else {
						notify(
							sprintf(
								/* translators: %d: number that failed */
								__( 'Failed to trash %d newsletter(s). Please try again.', 'newspack-newsletters' ),
								failed.length
							),
							'error'
						);
					}
				} }
			/>
		),
	};

	const restoreAction = {
		id: 'restore',
		label: __( 'Restore as draft', 'newspack-newsletters' ),
		supportsBulk: true,
		isEligible: isTrashed,
		callback: async items => {
			const failed = [];
			await Promise.all(
				items.map( item =>
					restoreOne( item.id ).catch( () => {
						failed.push( item );
					} )
				)
			);
			refresh();
			if ( failed.length === 0 ) {
				notify( _n( 'Newsletter restored as draft.', 'Newsletters restored as draft.', items.length, 'newspack-newsletters' ) );
			} else {
				notify(
					sprintf(
						/* translators: %d: number that failed */
						__( 'Failed to restore %d newsletter(s).', 'newspack-newsletters' ),
						failed.length
					),
					'error'
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
						notify( _n( 'Newsletter deleted.', 'Newsletters deleted.', list.length, 'newspack-newsletters' ) );
					} else {
						notify(
							sprintf(
								/* translators: %d: number that failed */
								__( 'Failed to delete %d newsletter(s).', 'newspack-newsletters' ),
								failed.length
							),
							'error'
						);
					}
				} }
			/>
		),
	};

	return [ editAction, viewAction, makePublicAction, makeNonPublicAction, trashAction, restoreAction, deleteAction ];
}

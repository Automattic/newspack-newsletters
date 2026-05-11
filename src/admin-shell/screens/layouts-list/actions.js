/**
 * Per-row + bulk actions for the Layouts list.
 */

import apiFetch from '@wordpress/api-fetch';
import {
	Button,
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
} from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';

import { LAYOUT_CPT_SLUG } from '../../../utils/consts';
import { notifyError, notifySuccess } from '../../notices';

const COLLECTION_PATH = `/wp/v2/${ LAYOUT_CPT_SLUG }`;

function buildEditUrl( item ) {
	const adminUrl = window.newspackNewslettersAdmin?.adminUrl || '/wp-admin/';
	return `${ adminUrl }post.php?post=${ item.id }&action=edit`;
}

const deleteOne = id => apiFetch( { path: `${ COLLECTION_PATH }/${ id }?force=true`, method: 'DELETE' } );

function copyTitle( source ) {
	const sourceTitle = source?.title?.raw ?? source?.title?.rendered ?? __( 'Untitled', 'newspack-newsletters' );
	return sprintf(
		/* translators: %s: original layout title */
		__( 'Copy of %s', 'newspack-newsletters' ),
		sourceTitle
	);
}

// Synthetic `prebuilt-<n>` id has no REST counterpart, so the copy is
// built from the in-memory item; status=draft so the user can review.
async function duplicatePrebuilt( item ) {
	return apiFetch( {
		path: COLLECTION_PATH,
		method: 'POST',
		data: {
			status: 'draft',
			title: copyTitle( item ),
			content: item?.content?.raw ?? '',
		},
	} );
}

async function duplicateSaved( item ) {
	// Re-fetch in `context=edit` so the duplicate is robust against
	// future callers passing a leaner item shape than the list payload.
	const source = await apiFetch( { path: `${ COLLECTION_PATH }/${ item.id }?context=edit` } );
	return apiFetch( {
		path: COLLECTION_PATH,
		method: 'POST',
		data: {
			status: 'publish',
			title: copyTitle( source ),
			content: source?.content?.raw ?? '',
			meta: {
				font_header: source?.meta?.font_header ?? '',
				font_body: source?.meta?.font_body ?? '',
				background_color: source?.meta?.background_color ?? '',
				text_color: source?.meta?.text_color ?? '',
				custom_css: source?.meta?.custom_css ?? '',
				campaign_defaults: source?.meta?.campaign_defaults ?? '',
				disable_auto_ads: !! source?.meta?.disable_auto_ads,
			},
		},
	} );
}

const duplicateOne = item => ( item?.is_prebuilt ? duplicatePrebuilt( item ) : duplicateSaved( item ) );

function ConfirmDeleteModal( { items, closeModal, onConfirm } ) {
	const [ isBusy, setIsBusy ] = useState( false );
	const question = sprintf(
		/* translators: %d: number of layouts */
		_n(
			'Permanently delete %d layout? Newsletters created from it keep their content; only the saved layout entry is removed. This cannot be undone.',
			'Permanently delete %d layouts? Newsletters created from them keep their content; only the saved layout entries are removed. This cannot be undone.',
			items.length,
			'newspack-newsletters'
		),
		items.length
	);

	return (
		<VStack spacing={ 4 }>
			<p style={ { margin: 0 } }>{ question }</p>
			<HStack justify="flex-end" spacing={ 2 }>
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
			</HStack>
		</VStack>
	);
}

// Prebuilts are bundled JSON, shared across every site, and locked from
// every mutating action in this view.
const isUserOwned = item => ! item?.is_prebuilt;

export function getActions( { onRenameStart, onMutated } ) {
	const editAction = {
		id: 'edit',
		label: __( 'Edit', 'newspack-newsletters' ),
		isPrimary: true,
		isEligible: isUserOwned,
		callback: items => {
			const item = items[ 0 ];
			if ( ! item ) {
				return;
			}
			window.location.href = buildEditUrl( item );
		},
	};

	const duplicateAction = {
		id: 'duplicate',
		label: __( 'Duplicate', 'newspack-newsletters' ),
		callback: async items => {
			const item = items[ 0 ];
			if ( ! item ) {
				return;
			}
			try {
				await duplicateOne( item );
				onMutated();
				notifySuccess( __( 'Layout duplicated.', 'newspack-newsletters' ) );
			} catch ( error ) {
				notifyError( __( 'Failed to duplicate layout.', 'newspack-newsletters' ) );
			}
		},
	};

	const renameAction = {
		id: 'rename',
		label: __( 'Rename', 'newspack-newsletters' ),
		isEligible: isUserOwned,
		callback: items => {
			const item = items[ 0 ];
			if ( ! item ) {
				return;
			}
			onRenameStart( item );
		},
	};

	const deleteAction = {
		id: 'delete-permanently',
		label: __( 'Delete', 'newspack-newsletters' ),
		isDestructive: true,
		supportsBulk: true,
		isEligible: isUserOwned,
		modalSize: 'small',
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
					onMutated();
					if ( failed.length === 0 ) {
						notifySuccess( _n( 'Layout deleted.', 'Layouts deleted.', list.length, 'newspack-newsletters' ) );
					} else {
						notifyError(
							sprintf(
								/* translators: %d: number that failed */
								__( 'Failed to delete %d layout(s). Please try again.', 'newspack-newsletters' ),
								failed.length
							)
						);
					}
				} }
			/>
		),
	};

	return [ editAction, duplicateAction, renameAction, deleteAction ];
}

/**
 * Update a layout's title. Rejects on failure so the caller can leave
 * the inline-rename UI in place for retry.
 *
 * @param {number} id    Post id.
 * @param {string} title New title (already trimmed).
 * @return {Promise} Promise resolving to the updated post on success.
 */
export function renameLayout( id, title ) {
	return apiFetch( {
		path: `${ COLLECTION_PATH }/${ id }`,
		method: 'POST',
		data: { title },
	} );
}

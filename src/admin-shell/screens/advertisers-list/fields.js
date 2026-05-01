/**
 * Field definitions for the Advertisers list DataView.
 *
 * Default columns: Name, Description, Slug, Count.
 *
 * `name` and `slug` map to native WP REST `orderby` values; description
 * and count are not native sortable orderbys (the terms controller's
 * schema only exposes `orderby` ∈ { id, include, name, slug, term_group,
 * description, count }, and `description` / `count` are stable enough
 * column-side that JS-level sort would be a regression vs server-side).
 * Limit `enableSorting` to fields that produce a meaningful sort.
 */

import { __ } from '@wordpress/i18n';

export function getFields( { onEdit } = {} ) {
	const renderName = ( { item } ) => {
		const label = item?.name || __( '(no name)', 'newspack-newsletters' );
		if ( ! onEdit ) {
			return <strong>{ label }</strong>;
		}
		// Render as a button-style link so keyboard users can activate
		// the Edit modal from the column directly. The DataView's
		// per-row Edit action remains the primary path for mouse users.
		// `stopPropagation` on the click event prevents the DataView's
		// row-click handler from also flipping the row's selection
		// checkbox — without it, opening the modal toggles the row.
		return (
			<button
				type="button"
				className="newspack-newsletters-list__title"
				onClick={ event => {
					event.stopPropagation();
					onEdit( item );
				} }
				style={ {
					background: 'none',
					border: 'none',
					cursor: 'pointer',
					padding: 0,
					textAlign: 'left',
				} }
			>
				<strong>{ label }</strong>
			</button>
		);
	};

	return [
		{
			id: 'name',
			label: __( 'Name', 'newspack-newsletters' ),
			enableGlobalSearch: true,
			enableSorting: true,
			getValue: ( { item } ) => item?.name || '',
			render: renderName,
		},
		{
			id: 'description',
			label: __( 'Description', 'newspack-newsletters' ),
			enableSorting: false,
			getValue: ( { item } ) => item?.description || '',
		},
		{
			id: 'slug',
			label: __( 'Slug', 'newspack-newsletters' ),
			enableSorting: true,
			getValue: ( { item } ) => item?.slug || '',
		},
		{
			id: 'count',
			label: __( 'Count', 'newspack-newsletters' ),
			enableSorting: true,
			getValue: ( { item } ) => Number( item?.count ?? 0 ),
			render: ( { item } ) => String( item?.count ?? 0 ),
		},
	];
}

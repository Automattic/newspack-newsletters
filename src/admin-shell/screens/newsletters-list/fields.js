/**
 * Field definitions for the Newsletters list DataView.
 *
 * Columns map the existing CPT list (Title, Public page, Date, Author,
 * Categories) plus the modern additions called out in NEWS-1928 (Status,
 * Send date, Send list). Status renders via the consolidated REST field
 * `newspack_newsletters_status` so we never re-derive sent/scheduled
 * client-side. Server-side sort / filter — see build-query.
 */

import { __, sprintf } from '@wordpress/i18n';
import { dateI18n, getSettings as getDateSettings } from '@wordpress/date';

import { getAdminUrl } from '../../admin-globals';
import { statusKindLabel, STATUS_KIND_LABELS } from './status-label';

const formatDate = timestamp => {
	if ( ! timestamp ) {
		return '';
	}
	const settings = getDateSettings();
	const format = settings.formats?.datetime || 'M j, Y g:ia';
	return dateI18n( format, timestamp * 1000 );
};

const editUrl = item => `${ getAdminUrl() }post.php?post=${ item.id }&action=edit`;

// `title.rendered` is HTML-encoded by WP REST, so entities like `&amp;`
// or `&#8217;` would display literally in the DataView. Prefer
// `title.raw` (always present with `context=edit`, which we request) and
// fall back to the rendered value for safety. Reused by `getValue` so
// search / sort / display stay consistent.
const getTitle = item => item?.title?.raw ?? item?.title?.rendered ?? '';

const renderTitle = ( { item } ) => {
	const title = getTitle( item ) || __( '(no title)', 'newspack-newsletters' );
	return (
		<a className="newspack-newsletters-list__title" href={ editUrl( item ) }>
			<strong>{ title }</strong>
		</a>
	);
};

const renderStatus = ( { item } ) => {
	const status = item?.newspack_newsletters_status || {};
	const kind = status.kind || 'draft';

	if ( 'sent' === kind && status.sent_at ) {
		return sprintf(
			/* translators: %s: formatted send date */
			__( 'Sent %s', 'newspack-newsletters' ),
			formatDate( status.sent_at )
		);
	}

	if ( 'scheduled' === kind && status.scheduled_at ) {
		return sprintf(
			/* translators: %s: formatted scheduled date */
			__( 'Scheduled for %s', 'newspack-newsletters' ),
			formatDate( status.scheduled_at )
		);
	}

	return statusKindLabel( kind );
};

const renderSendDate = ( { item } ) => {
	const status = item?.newspack_newsletters_status || {};
	const ts = status.sent_at || status.scheduled_at;
	return ts ? formatDate( ts ) : '';
};

const renderSendList = ( { item } ) => {
	const id = item?.meta?.send_list_id || '';
	const sublistId = item?.meta?.send_sublist_id || '';
	if ( ! id ) {
		return <span className="newspack-newsletters-list__empty">&mdash;</span>;
	}
	return <code className="newspack-newsletters-list__send-list">{ sublistId ? `${ id } / ${ sublistId }` : id }</code>;
};

const renderAuthor = ( { item } ) => {
	const author = item?._embedded?.author?.[ 0 ];
	return author?.name || '';
};

const renderCategories = ( { item } ) => {
	const terms = item?._embedded?.[ 'wp:term' ] || [];
	const categories = terms[ 0 ] || [];
	return categories
		.map( term => term?.name )
		.filter( Boolean )
		.join( ', ' );
};

const renderPublicPage = ( { item } ) => {
	const isPublic = !! item?.meta?.is_public;
	return isPublic ? __( 'Yes', 'newspack-newsletters' ) : __( 'No', 'newspack-newsletters' );
};

const renderDate = ( { item } ) => {
	if ( ! item?.date ) {
		return '';
	}
	// `item.date` is the WP REST representation in the **site** timezone
	// (no trailing `Z`). Pass it straight to `dateI18n` — the legacy
	// `new Date( ... ).getTime()` round-trip parsed it as the **browser's**
	// local timezone and shifted the displayed time for off-site admins.
	const settings = getDateSettings();
	const format = settings.formats?.datetime || 'M j, Y g:ia';
	return dateI18n( format, item.date );
};

export function getFields() {
	const statusLabels = STATUS_KIND_LABELS();

	return [
		{
			id: 'title',
			label: __( 'Title', 'newspack-newsletters' ),
			enableGlobalSearch: true,
			getValue: ( { item } ) => getTitle( item ),
			render: renderTitle,
		},
		{
			id: 'status',
			label: __( 'Status', 'newspack-newsletters' ),
			elements: [
				{ value: 'publish,private', label: statusLabels.sent },
				{ value: 'future', label: statusLabels.scheduled },
				{ value: 'draft', label: statusLabels.draft },
				{ value: 'trash', label: statusLabels.trash },
			],
			filterBy: { operators: [ 'isAny' ] },
			getValue: ( { item } ) => item?.newspack_newsletters_status?.kind || 'draft',
			render: renderStatus,
		},
		{
			id: 'send_date',
			label: __( 'Send date', 'newspack-newsletters' ),
			enableSorting: true,
			getValue: ( { item } ) => item?.newspack_newsletters_status?.sent_at || item?.newspack_newsletters_status?.scheduled_at || 0,
			render: renderSendDate,
		},
		{
			id: 'send_list',
			label: __( 'Send list', 'newspack-newsletters' ),
			enableSorting: false,
			getValue: ( { item } ) => item?.meta?.send_list_id || '',
			render: renderSendList,
		},
		{
			id: 'author',
			label: __( 'Author', 'newspack-newsletters' ),
			enableSorting: true,
			getValue: ( { item } ) => item?._embedded?.author?.[ 0 ]?.name || '',
			render: renderAuthor,
		},
		{
			id: 'categories',
			label: __( 'Categories', 'newspack-newsletters' ),
			enableSorting: false,
			getValue: ( { item } ) =>
				( item?._embedded?.[ 'wp:term' ]?.[ 0 ] || [] )
					.map( term => term?.name )
					.filter( Boolean )
					.join( ', ' ),
			render: renderCategories,
		},
		{
			id: 'public_page',
			label: __( 'Public page', 'newspack-newsletters' ),
			elements: [
				{ value: '1', label: __( 'Yes', 'newspack-newsletters' ) },
				{ value: '0', label: __( 'No', 'newspack-newsletters' ) },
			],
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => ( item?.meta?.is_public ? '1' : '0' ),
			render: renderPublicPage,
		},
		{
			id: 'date',
			label: __( 'Date', 'newspack-newsletters' ),
			enableSorting: true,
			getValue: ( { item } ) => item?.date || '',
			render: renderDate,
		},
	];
}

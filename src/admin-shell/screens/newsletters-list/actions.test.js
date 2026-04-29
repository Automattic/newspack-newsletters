import { getActions } from './actions';

describe( 'newsletters list actions', () => {
	const refresh = jest.fn();

	const draftRow = { id: 1, status: 'draft', meta: { is_public: false }, link: '' };
	const sentPublicRow = {
		id: 2,
		status: 'publish',
		meta: { is_public: true },
		link: 'https://example.test/n/2',
	};
	const trashedRow = { id: 3, status: 'trash', meta: { is_public: false }, link: '' };

	const byId = id => getActions( { refresh } ).find( action => action.id === id );

	it( 'exposes the expected action ids in order', () => {
		const ids = getActions( { refresh } ).map( action => action.id );
		expect( ids ).toEqual( [ 'edit', 'view-public-page', 'make-public', 'make-non-public', 'trash', 'restore', 'delete-permanently' ] );
	} );

	it( 'marks Edit as the primary action', () => {
		expect( byId( 'edit' ).isPrimary ).toBe( true );
	} );

	it( 'View public page is eligible only when is_public and a link exists and the row is not trashed', () => {
		const action = byId( 'view-public-page' );
		expect( action.isEligible( sentPublicRow ) ).toBe( true );
		expect( action.isEligible( draftRow ) ).toBe( false );
		expect( action.isEligible( { ...sentPublicRow, status: 'trash' } ) ).toBe( false );
	} );

	it( 'Trash is eligible only when the row is not already trashed', () => {
		const action = byId( 'trash' );
		expect( action.isEligible( draftRow ) ).toBe( true );
		expect( action.isEligible( sentPublicRow ) ).toBe( true );
		expect( action.isEligible( trashedRow ) ).toBe( false );
	} );

	it( 'Trash supports bulk and is destructive', () => {
		const action = byId( 'trash' );
		expect( action.supportsBulk ).toBe( true );
		expect( action.isDestructive ).toBe( true );
	} );

	it( 'Restore is eligible only on trashed rows', () => {
		const action = byId( 'restore' );
		expect( action.isEligible( trashedRow ) ).toBe( true );
		expect( action.isEligible( draftRow ) ).toBe( false );
		expect( action.isEligible( sentPublicRow ) ).toBe( false );
	} );

	it( 'Restore supports bulk', () => {
		expect( byId( 'restore' ).supportsBulk ).toBe( true );
	} );

	it( 'Delete permanently is eligible only on trashed rows and is destructive', () => {
		const action = byId( 'delete-permanently' );
		expect( action.isEligible( trashedRow ) ).toBe( true );
		expect( action.isEligible( draftRow ) ).toBe( false );
		expect( action.isDestructive ).toBe( true );
		expect( action.supportsBulk ).toBe( true );
	} );

	it( 'Make public supports bulk and is eligible only on non-trashed, currently-non-public rows', () => {
		const action = byId( 'make-public' );
		expect( action.supportsBulk ).toBe( true );
		expect( action.isEligible( draftRow ) ).toBe( true );
		expect( action.isEligible( sentPublicRow ) ).toBe( false );
		expect( action.isEligible( trashedRow ) ).toBe( false );
	} );

	it( 'Make non-public supports bulk and is eligible only on non-trashed, currently-public rows', () => {
		const action = byId( 'make-non-public' );
		expect( action.supportsBulk ).toBe( true );
		expect( action.isEligible( sentPublicRow ) ).toBe( true );
		expect( action.isEligible( draftRow ) ).toBe( false );
		expect( action.isEligible( { ...sentPublicRow, status: 'trash' } ) ).toBe( false );
	} );

	it( 'never exposes a publish or status-changing bulk action — campaign-send safety guard', () => {
		const ids = getActions( { refresh } ).map( action => action.id );
		// `make-public` / `make-non-public` are meta-only and don't fire
		// `transition_post_status`, so they're safe; the guard is against
		// post-status changes that would dispatch ESP campaigns.
		expect( ids ).not.toEqual( expect.arrayContaining( [ 'publish', 'private', 'transition-status' ] ) );
	} );
} );

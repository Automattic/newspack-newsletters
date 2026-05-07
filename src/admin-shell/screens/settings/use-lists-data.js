import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';

const LISTS_PATH = '/newspack-newsletters/v1/lists';

export default function useListsData() {
	const [ lists, setLists ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	// Per-row sequence counter. A second PATCH on the same row supersedes
	// the first; out-of-order responses for stale sequences are ignored so
	// a slow earlier request can't overwrite a later one's UI state.
	const sequencesRef = useRef( new Map() );

	const load = useCallback( async () => {
		setIsLoading( true );
		setError( null );
		try {
			const response = await apiFetch( { path: LISTS_PATH } );
			setLists( Array.isArray( response ) ? response : [] );
		} catch ( err ) {
			setError( err );
		} finally {
			setIsLoading( false );
		}
	}, [] );

	useEffect( () => {
		load();
	}, [ load ] );

	// Optimistic per-row PATCH. Rolls back only the failing row (so a
	// concurrent toggle on a sibling row isn't clobbered) and skips stale
	// responses (so a slower earlier request can't overwrite a newer one).
	const patchList = useCallback( async ( dbId, patch ) => {
		const seq = ( sequencesRef.current.get( dbId ) || 0 ) + 1;
		sequencesRef.current.set( dbId, seq );
		let preRowSnapshot = null;
		setLists( current => {
			const targetRow = current.find( row => row.db_id === dbId );
			preRowSnapshot = targetRow ? { ...targetRow } : null;
			return current.map( row => ( row.db_id === dbId ? { ...row, ...patch } : row ) );
		} );
		try {
			const response = await apiFetch( {
				path: `${ LISTS_PATH }/${ dbId }`,
				method: 'PATCH',
				data: patch,
			} );
			if ( sequencesRef.current.get( dbId ) === seq ) {
				setLists( current => current.map( row => ( row.db_id === dbId ? { ...row, ...response } : row ) ) );
			}
			return response;
		} catch ( err ) {
			if ( sequencesRef.current.get( dbId ) === seq && preRowSnapshot ) {
				const restored = preRowSnapshot;
				setLists( current => current.map( row => ( row.db_id === dbId ? restored : row ) ) );
			}
			throw err;
		}
	}, [] );

	return { lists, isLoading, error, reload: load, patchList };
}

import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useState } from '@wordpress/element';

const LISTS_PATH = '/newspack-newsletters/v1/lists';

export default function useListsData() {
	const [ lists, setLists ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState( null );

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

	// Optimistic per-row PATCH; rolls back on error.
	const patchList = useCallback( async ( dbId, patch ) => {
		let snapshot;
		setLists( current => {
			snapshot = current;
			return current.map( row => ( row.db_id === dbId ? { ...row, ...patch } : row ) );
		} );
		try {
			const response = await apiFetch( {
				path: `${ LISTS_PATH }/${ dbId }`,
				method: 'PATCH',
				data: patch,
			} );
			setLists( current => current.map( row => ( row.db_id === dbId ? { ...row, ...response } : row ) ) );
			return response;
		} catch ( err ) {
			if ( snapshot ) {
				setLists( snapshot );
			}
			throw err;
		}
	}, [] );

	return { lists, isLoading, error, reload: load, patchList };
}

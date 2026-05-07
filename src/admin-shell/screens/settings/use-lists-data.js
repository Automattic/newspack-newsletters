import apiFetch from '@wordpress/api-fetch';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';

const LISTS_PATH = '/newspack-newsletters/v1/lists';

export default function useListsData() {
	const [ lists, setLists ] = useState( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState( null );
	// Per-row sequence + chain so concurrent same-row PATCHes serialise in click order both client- and server-side.
	const sequencesRef = useRef( new Map() );
	const queuesRef = useRef( new Map() );

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

	const patchList = useCallback( ( dbId, patch ) => {
		const seq = ( sequencesRef.current.get( dbId ) || 0 ) + 1;
		sequencesRef.current.set( dbId, seq );
		let preRowSnapshot = null;
		setLists( current => {
			const targetRow = current.find( row => row.db_id === dbId );
			preRowSnapshot = targetRow ? { ...targetRow } : null;
			return current.map( row => ( row.db_id === dbId ? { ...row, ...patch } : row ) );
		} );
		const previous = queuesRef.current.get( dbId ) || Promise.resolve();
		const next = previous
			.catch( () => {} )
			.then( async () => {
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
			} );
		queuesRef.current.set( dbId, next );
		return next;
	}, [] );

	return { lists, isLoading, error, reload: load, patchList };
}

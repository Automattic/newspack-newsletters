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

	const save = useCallback( async nextLists => {
		const payload = {
			lists: nextLists.map( list => ( {
				id: list.id,
				active: !! list.active,
				// Server-side `sanitize_lists()` rejects rows with an empty
				// title, so fall back to the remote/local list name when the
				// user clears the field — preserves the "reset to default"
				// affordance without breaking the save.
				title: ( list.title && list.title.trim() ) || list.remote_name || list.name || '',
				description: list.description || '',
			} ) ),
		};
		const response = await apiFetch( {
			path: LISTS_PATH,
			method: 'POST',
			data: payload,
		} );
		setLists( Array.isArray( response ) ? response : nextLists );
		return response;
	}, [] );

	return { lists, isLoading, error, reload: load, save };
}

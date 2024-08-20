/**
 * WordPress dependencies.
 */
import apiFetch from '@wordpress/api-fetch';
import { createReduxStore, dispatch, register, useSelect } from '@wordpress/data';

export const STORE_NAMESPACE = 'newspack/newsletters';

const DEFAULT_STATE = {
	newsletterData: {},
	isLoading: true,
	error: null,
};
const createAction = type => payload => ( { type, payload } );
const reducer = ( state = DEFAULT_STATE, { type, payload = {} } ) => {
	switch ( type ) {
		case 'SET_DATA':
			return { ...state, newsletterData: payload };
		case 'SET_ERROR':
			return { ...state, error: payload };
		default:
			return state;
	}
};

const actions = {
	// Regular actions.
	setData: createAction( 'SET_DATA' ),
	setError: createAction( 'SET_ERROR' ),
};

const selectors = {
	isLoading: state => state.isLoading,
	getData: state => state.newsletterData || {},
	getError: state => state.error,
};

const store = createReduxStore( STORE_NAMESPACE, {
	reducer,
	actions,
	selectors,
} );

// Register the editor store.
export const registerStore = () => register( store );

// Hook to use the newsletter data from any editor component.
export const useNewsletterData = () =>
	useSelect( select =>
		select( STORE_NAMESPACE ).getData()
	);

// Dispatcher to rehydrate newsletter data from the server.
export const fetchNewsletterData = async postId => {
	try {
		const response = await apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/retrieve`,
		} );
		updateNewsletterData( response );
	} catch ( error ) {
		dispatch( STORE_NAMESPACE ).setError( error );
	}
};

// Dispatcher to update newsletter data in the store.
export const updateNewsletterData = data =>
	dispatch( STORE_NAMESPACE ).setData( data );
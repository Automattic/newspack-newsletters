/**
 * A Redux store for ESP newsletter data to be used across editor components.
 * This store is a centralized place for all data fetched from or updated via the ESP's API.
 *
 * Import use* hooks to read store data from any component.
 * Import fetch* hooks to fetch updated ESP data from any component.
 * Import update* hooks to update store data from any component.
 */

/**
 * WordPress dependencies.
 */
import apiFetch from '@wordpress/api-fetch';
import { createReduxStore, dispatch, register, useSelect, select as coreSelect } from '@wordpress/data';
import { addQueryArgs } from '@wordpress/url';

/**
 * Internal dependencies
 */
import { getServiceProvider } from '../service-providers';

/**
 * External dependencies
 */
import { debounce, sortBy } from 'lodash';

export const STORE_NAMESPACE = 'newspack/newsletters';

const DEFAULT_STATE = {
	isRetrieving: false,
	newsletterData: {},
	error: null,
};
const createAction = type => payload => ( { type, payload } );
const reducer = ( state = DEFAULT_STATE, { type, payload = {} } ) => {
	switch ( type ) {
		case 'SET_IS_RETRIEVING':
			return { ...state, isRetrieving: payload };
		case 'SET_DATA':
			const updatedNewsletterData = { ...state.newsletterData, ...payload };
			return { ...state, newsletterData: updatedNewsletterData };
		case 'SET_ERROR':
			return { ...state, error: payload };
		default:
			return state;
	}
};

const actions = {
	// Regular actions.
	setIsRetrieving: createAction( 'SET_IS_RETRIEVING' ),
	setData: createAction( 'SET_DATA' ),
	setError: createAction( 'SET_ERROR' ),
};

const selectors = {
	getIsRetrieving: state => state.isRetrieving,
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

// Hook to use the retrieval status from any editor component.
export const useIsRetrieving = () =>
	useSelect( select =>
		select( STORE_NAMESPACE ).getIsRetrieving()
	);

// Hook to use the newsletter data from any editor component.
export const useNewsletterData = () =>
	useSelect( select =>
		select( STORE_NAMESPACE ).getData()
	);

// Hook to use newsletter data fetch errors from any editor component.
export const useNewsletterDataError = () =>
	useSelect( select =>
		select( STORE_NAMESPACE ).getError()
	);

// Dispatcher to update retrieval status in the store.
export const updateIsRetrieving = isRetrieving =>
	dispatch( STORE_NAMESPACE ).setIsRetrieving( isRetrieving );

// Dispatcher to update newsletter data in the store.
export const updateNewsletterData = data =>
	dispatch( STORE_NAMESPACE ).setData( data );

// Dispatcher to update newsletter error in the store.
export const updateNewsletterDataError = error =>
	dispatch( STORE_NAMESPACE ).setError( error );

// Dispatcher to fetch newsletter data from the server.
export const fetchNewsletterData = async postId => {
	const isRetrieving = coreSelect( STORE_NAMESPACE ).getIsRetrieving();
	if ( isRetrieving ) {
		return;
	}
	updateIsRetrieving( true );
	updateNewsletterDataError( null );
	try {
		const { name } = getServiceProvider();
		const response = await apiFetch( {
			path: `/newspack-newsletters/v1/${ name }/${ postId }/retrieve`,
		} );

		// If we've already fetched list or sublist info, retain it.
		const newsletterData = coreSelect( STORE_NAMESPACE ).getData();
		const updatedNewsletterData = { ...response };
		if ( newsletterData?.lists ) {
			updatedNewsletterData.lists = newsletterData.lists;
		}
		if ( newsletterData?.sublists ) {
			updatedNewsletterData.sublists = newsletterData.sublists;
		}
		updateNewsletterData( updatedNewsletterData );
	} catch ( error ) {
		updateNewsletterDataError( error );
	}
	updateIsRetrieving( false );
	return true;
};

// Dispatcher to fetch any errors from the most recent sync attempt.
export const fetchSyncErrors = async postId => {
	const isRetrieving = coreSelect( STORE_NAMESPACE ).getIsRetrieving();
	if ( isRetrieving ) {
		return;
	}
	updateIsRetrieving( true );
	updateNewsletterDataError( null );
	try {
		const response = await apiFetch( {
			path: `/newspack-newsletters/v1/${ postId }/sync-error`,
		} );
		if ( response?.message ) {
			updateNewsletterDataError( response );
		}
	} catch ( error ) {
		updateNewsletterDataError( error );
	}
	updateIsRetrieving( false );
	return true;
}

// Dispatcher to fetch send lists and sublists from the connected ESP and update the newsletterData in store.
export const fetchSendLists = debounce( async ( opts, replace = false ) => {
	updateNewsletterDataError( null );
	try {
		const { name } = getServiceProvider();
		const args = {
			type: 'list',
			limit: 10,
			provider: name,
			...opts,
		};

		const newsletterData = coreSelect( STORE_NAMESPACE ).getData();
		const sendLists = 'list' === args.type ? [ ...newsletterData?.lists ] || [] : [ ...newsletterData?.sublists ] || [];

		// If we already have a matching result, no need to fetch more.
		const foundItems = sendLists.filter( item => {
			const ids = args.ids && ! Array.isArray( args.ids ) ? [ args.ids ] : args.ids;
			const search = args.search && ! Array.isArray( args.search ) ? [ args.search ] : args.search;
			let found = false;
			if ( ids?.length ) {
				ids.forEach( id => {
					found = item.id.toString() === id.toString();
				} )
			}
			if ( search?.length ) {
				search.forEach( term => {
					if ( item.label.toLowerCase().includes( term.toLowerCase() ) ) {
						found = true;
					}
				} );
			}

			return found;
		} );

		if ( foundItems.length ) {
			return sendLists;
		}

		const updatedNewsletterData = { ...newsletterData };
		const updatedSendLists = replace ? [] : [ ...sendLists ];

		// If no existing items found, fetch from the ESP.
		const isRetrieving = coreSelect( STORE_NAMESPACE ).getIsRetrieving();
		if ( isRetrieving ) {
			return;
		}
		updateIsRetrieving( true );
		const response = await apiFetch( {
			path: addQueryArgs(
				'/newspack-newsletters/v1/send-lists',
				args
			)
		} );

		response.forEach( item => {
			if ( ! updatedSendLists.find( listItem => listItem.id === item.id ) ) {
				updatedSendLists.push( item );
			}
		} );
		if ( 'list' === args.type ) {
			updatedNewsletterData.lists = sortBy( updatedSendLists, 'label' );
		} else {
			updatedNewsletterData.sublists = sortBy( updatedSendLists, 'label' );
		}

		updateNewsletterData( updatedNewsletterData );
	} catch ( error ) {
		updateNewsletterDataError( error );
	}
	updateIsRetrieving( false );
}, 500 );
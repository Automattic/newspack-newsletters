/**
 * External dependencies
 */
import { uniq, pick, flatten, values, flatMap, slice } from 'lodash';

/**
 * WordPress dependencies
 */
import { registerStore } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { POSTS_INSERTER_BLOCK_NAME, POSTS_INSERTER_STORE_NAME } from './consts';

const DEFAULT_STATE = {
	postIdsByBlocks: {},
	existingBlockIds: [],
};

const actions = {
	setHandledPostsIds( ids, props ) {
		return {
			type: 'SET_HANDLED_POST_IDS',
			handledPostIds: ids,
			props,
		};
	},
};

const getAllPostsInserterBlocksIds = blocks =>
	flatMap( blocks, block => [
		...( block.name === POSTS_INSERTER_BLOCK_NAME ? [ block.clientId ] : [] ),
		...getAllPostsInserterBlocksIds( block.innerBlocks ),
	] );

registerStore( POSTS_INSERTER_STORE_NAME, {
	reducer( state = DEFAULT_STATE, action ) {
		switch ( action.type ) {
			case 'SET_HANDLED_POST_IDS':
				const { clientId, existingBlocks } = action.props;
				const existingBlockIds = getAllPostsInserterBlocksIds( existingBlocks );
				return {
					existingBlockIds,
					postIdsByBlocks: pick(
						{
							...state.postIdsByBlocks,
							[ clientId ]: action.handledPostIds,
						},
						existingBlockIds
					),
				};
		}

		return state;
	},

	actions,

	selectors: {
		getHandledPostIds( { postIdsByBlocks, existingBlockIds }, blockClientId ) {
			const blockIndex = existingBlockIds.indexOf( blockClientId );
			const blocksBeforeIds = slice( existingBlockIds, 0, blockIndex );
			return uniq( flatten( values( pick( postIdsByBlocks, blocksBeforeIds ) ) ) );
		},
	},
} );

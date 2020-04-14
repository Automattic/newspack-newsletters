/**
 * External dependencies
 */
import { some, concat, without } from 'lodash';

/**
 * WordPress dependencies
 */
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { useState, useEffect } from '@wordpress/element';

const NestedColumnsDetectionBase = ( { blocks, updateBlock } ) => {
	const [ warnedAboutNestedColumnsBlocksIds, setWarnedAboutNestedColumnsBlocksIds ] = useState(
		[]
	);

	const handleInnerBlocksContent = innerBlocks => {
		innerBlocks.forEach( innerBlock => {
			if ( innerBlock.name === 'core/column' ) {
				const hasCols = some( innerBlock.innerBlocks, ( { name } ) => name === 'core/columns' );
				const hasWarning = warnedAboutNestedColumnsBlocksIds.indexOf( innerBlock.clientId ) >= 0;
				if ( hasCols && ! hasWarning ) {
					setWarnedAboutNestedColumnsBlocksIds(
						concat( warnedAboutNestedColumnsBlocksIds, innerBlock.clientId )
					);
					updateBlock( innerBlock.clientId, {
						...innerBlock,
						attributes: { __nestedColumnWarning: true },
					} );
				} else if ( ! hasCols && hasWarning ) {
					setWarnedAboutNestedColumnsBlocksIds(
						without( warnedAboutNestedColumnsBlocksIds, innerBlock.clientId )
					);
					updateBlock( innerBlock.clientId, {
						...innerBlock,
						attributes: { __nestedColumnWarning: false },
					} );
				}
			}
		} );
	};

	useEffect(() => {
		blocks.forEach( block => handleInnerBlocksContent( block.innerBlocks ) );
	}, [ blocks ]);

	return null;
};

export const NestedColumnsDetection = compose( [
	withSelect( select => {
		const { getBlocks } = select( 'core/block-editor' );
		const { getNotices } = select( 'core/notices' );
		return {
			blocks: getBlocks(),
			notices: getNotices(),
		};
	} ),
	withDispatch( dispatch => {
		return {
			updateBlock: ( id, block ) => {
				dispatch( 'core/block-editor' ).replaceBlock( id, block );
			},
		};
	} ),
] )( NestedColumnsDetectionBase );

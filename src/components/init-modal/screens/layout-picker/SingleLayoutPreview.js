/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { withDispatch } from '@wordpress/data';
import { parse } from '@wordpress/blocks';
import { useState } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';
import { ENTER, SPACE } from '@wordpress/keycodes';
import { BlockPreview } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { LAYOUT_CPT_SLUG } from '../../../../utils/consts';
import { setPreventDeduplicationForPostsInserter } from '../../../../editor/blocks/posts-inserter/utils';

const SingleLayoutPreview = ( {
	isEditable,
	deleteHandler,
	saveLayout,
	selectedLayoutId,
	setSelectedLayoutId,
	ID,
	post_title: title,
	post_content: content,
} ) => {
	const handleDelete = () => {
		// eslint-disable-next-line no-alert
		if ( confirm( __( 'Are you sure you want to delete this layout?', 'newspack-newsletters' ) ) ) {
			deleteHandler( ID );
		}
	};

	const [ layoutName, setLayoutName ] = useState( title );
	const [ isSaving, setIsSaving ] = useState( false );

	const handleLayoutNameChange = () => {
		setIsSaving( true );
		saveLayout( { title: layoutName } ).then( () => {
			setIsSaving( false );
		} );
	};

	return (
		<div
			key={ ID }
			className={ classnames( 'newspack-newsletters-layouts__item', {
				'is-active': selectedLayoutId === ID,
			} ) }
			onClick={ () => setSelectedLayoutId( ID ) }
			onKeyDown={ event => {
				if ( ENTER === event.keyCode || SPACE === event.keyCode ) {
					event.preventDefault();
					setSelectedLayoutId( ID );
				}
			} }
			role="button"
			tabIndex="0"
			aria-label={ title }
		>
			<div className="newspack-newsletters-layouts__item-preview">
				{ '' === content ? null : (
					<BlockPreview
						blocks={ setPreventDeduplicationForPostsInserter( parse( content ) ) }
						viewportWidth={ 600 }
					/>
				) }
			</div>
			{ isEditable ? (
				<TextControl
					className="newspack-newsletters-layouts__item-label"
					value={ layoutName }
					onChange={ setLayoutName }
					onBlur={ handleLayoutNameChange }
					disabled={ isSaving }
					onKeyDown={ event => {
						if ( ENTER === event.keyCode ) {
							handleLayoutNameChange();
						}
					} }
				/>
			) : (
				<div className="newspack-newsletters-layouts__item-label">{ title }</div>
			) }
			{ isEditable && (
				<Button isDestructive onClick={ handleDelete } disabled={ isSaving }>
					{ __( 'Delete', 'newspack-newsletters' ) }
				</Button>
			) }
		</div>
	);
};

export default withDispatch( ( dispatch, { ID } ) => {
	const { saveEntityRecord } = dispatch( 'core' );
	return {
		saveLayout: payload =>
			saveEntityRecord( 'postType', LAYOUT_CPT_SLUG, {
				status: 'publish',
				id: ID,
				...payload,
			} ),
	};
} )( SingleLayoutPreview );

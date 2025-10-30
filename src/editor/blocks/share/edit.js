/**
 * External dependencies
 */
import { find } from 'lodash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { RichText, useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { PanelBody, TextareaControl } from '@wordpress/components';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { SHARE_BLOCK_NOTICE_ID } from './consts';
import './style.scss';

const ShareBlock = ( { createTheNotice, removeNotice, is_public, attributes, setAttributes } ) => {
	const { content } = attributes;
	useEffect( () => {
		// eslint-disable-next-line no-unused-expressions
		is_public ? removeNotice() : createTheNotice();
		return removeNotice;
	}, [ is_public ] );

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Share settings', 'newspack-newsletters' ) }>
					<TextareaControl
						label={ __( 'Forwarded email content', 'newspack-newsletters' ) }
						help={ __(
							'Content of the email that will be pre-filled when a reader clicks this link in their email client. Use the "[LINK]" placeholder where the link to the public post should be placed.',
							'newspack-newsletters'
						) }
						value={ attributes.shareMessage }
						onChange={ value => setAttributes( { shareMessage: value } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<RichText
				identifier="content"
				tagName="a"
				{ ...useBlockProps( { className: 'newspack-newsletters-share-block' } ) }
				value={ content }
				allowedFormats={ [ 'core/bold', 'core/italic', 'core/text-color' ] }
				onChange={ newContent => setAttributes( { content: newContent } ) }
				aria-label={ __( 'Share block', 'newspack-newsletters' ) }
				data-empty={ content ? false : true }
			/>
		</>
	);
};

const ShareBlockWithData = compose(
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const { getNotices } = select( 'core/notices' );
		const { is_public } = getEditedPostAttribute( 'meta' );
		return {
			is_public,
			getNotices,
		};
	} ),
	withDispatch( ( dispatch, { getNotices } ) => {
		const { createWarningNotice, removeNotice } = dispatch( 'core/notices' );
		const hasNotice = Boolean( find( getNotices(), [ 'id', SHARE_BLOCK_NOTICE_ID ] ) );
		const { editPost } = dispatch( 'core/editor' );

		const createTheNotice = hasNotice
			? () => {}
			: () =>
					createWarningNotice(
						__(
							'This post is not public - the share block will not be displayed, since there is no post to link to.',
							'newspack-newsletters'
						),
						{
							id: SHARE_BLOCK_NOTICE_ID,
							isDismissible: false,
							actions: [
								{
									label: __( 'Make public', 'newspack-newsletters' ),
									onClick: () => editPost( { meta: { is_public: true } } ),
								},
							],
						}
					);
		return { createTheNotice, removeNotice: () => removeNotice( SHARE_BLOCK_NOTICE_ID ) };
	} )
)( ShareBlock );

export default ShareBlockWithData;

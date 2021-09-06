/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment, useState } from '@wordpress/element';
import { select } from '@wordpress/data';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { BlockControls, useBlockProps, RichText } from '@wordpress/block-editor';
import { createBlock } from '@wordpress/blocks';
import { globe } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './style.scss';

const EmbedPreview = props => {
	const caption = props.caption || props.title;
	let embedContent;
	switch ( props.type ) {
		case 'photo':
			if ( props.url ) {
				const style = {
					width: props.width,
					height: props.height,
				};
				embedContent = <img src={ props.url } alt={ caption } style={ style } />;
			}
			break;
		case 'video':
			if ( props.thumbnail_url ) {
				const style = {
					width: props.thumbnail_width,
					height: props.thumbnail_height,
				};
				embedContent = <img src={ props.thumbnail_url } alt={ props.title } style={ style } />;
			}
			break;
		case 'rich':
			if ( props.sanitized_html ) {
				embedContent = <div dangerouslySetInnerHTML={ { __html: props.sanitized_html } } />;
			}
			break;
	}
	return (
		<figure className={ classnames( props.className, 'wp-block-embed' ) }>
			<div className="wp-block-embed__newsletters-wrapper">{ embedContent }</div>
			{ ! RichText.isEmpty( caption ) && (
				<RichText
					tagName={ embedContent ? 'figcaption' : 'a' }
					placeholder={ __( 'Add caption' ) }
					value={ caption }
					onChange={ props.onCaptionChange }
					allowedFormats={ [ 'core/bold', 'core/italic', 'core/text-color' ] }
					inlineToolbar
					__unstableOnSplitAtEnd={ () =>
						props.insertBlocksAfter( createBlock( 'core/paragraph' ) )
					}
				/>
			) }
		</figure>
	);
};

export default () => {
	wp.hooks.addFilter(
		'editor.BlockEdit',
		'newspack-newsletters/embed-block-edit-editor',
		BlockEdit => {
			return props => {
				if ( props.name !== 'core/embed' ) return <BlockEdit { ...props } />;
				const { getEmbedPreview } = select( 'core' );
				const embedPreview = getEmbedPreview( props.attributes.url );
				if ( ! embedPreview ) return <BlockEdit { ...props } />;
				const [ isViewingEmail, setIsViewingEmail ] = useState( true );
				const blockProps = useBlockProps();
				return (
					<Fragment>
						<BlockControls>
							<ToolbarGroup>
								<ToolbarButton
									icon="email"
									label={ __( 'Preview email format', 'newspack-newsletters' ) }
									isActive={ isViewingEmail }
									onClick={ () => {
										setIsViewingEmail( true );
									} }
								/>
								<ToolbarButton
									icon={ globe }
									label={ __( 'Preview web format', 'newspack-newsletters' ) }
									isActive={ ! isViewingEmail }
									onClick={ () => {
										setIsViewingEmail( false );
									} }
								/>
							</ToolbarGroup>
						</BlockControls>
						{ isViewingEmail ? (
							<div { ...blockProps }>
								<EmbedPreview
									{ ...embedPreview }
									caption={ props.caption }
									onCaptionChange={ value => {
										props.setAttributes( { caption: value } );
									} }
									insertBlocksAfter={ props.insertBlocksAfter }
									isSelected={ props.isSelected }
									className={ props.className }
								/>
							</div>
						) : (
							<BlockEdit { ...props } />
						) }
					</Fragment>
				);
			};
		}
	);
};

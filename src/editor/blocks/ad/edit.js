/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { TextControl, PanelBody, Placeholder } from '@wordpress/components';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';
import { pullquote } from '@wordpress/icons';

export default function SubscribeEdit( { setAttributes, attributes: { adId } } ) {
	const blockProps = useBlockProps();
	return (
		<div { ...blockProps }>
			<InspectorControls>
				<PanelBody title={ __( 'Ad Settings' ) }>
					<TextControl
						label={ __( 'Ad ID' ) }
						value={ adId }
						onChange={ val => setAttributes( { adId: val } ) }
					/>
					<p>
						{ __(
							'By not selecting an ad, the system automatically choose which ad should be rendered here.',
							'newspack-newsletters'
						) }
					</p>
				</PanelBody>
			</InspectorControls>
			<Placeholder label={ __( 'Newsletter Ad', 'newspack-newsletters' ) } icon={ pullquote } />
		</div>
	);
}

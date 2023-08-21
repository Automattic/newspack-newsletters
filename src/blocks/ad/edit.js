/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { TextControl, ToggleControl, PanelBody, Placeholder } from '@wordpress/components';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';

export default function SubscribeEdit( {
	setAttributes,
	attributes: { automaticAd, adId, categoryId },
} ) {
	const blockProps = useBlockProps();
	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Ad Settings' ) }>
					<ToggleControl
						label={ __( 'Automatic Ad' ) }
						checked={ automaticAd }
						onChange={ val => setAttributes( { automaticAd: val } ) }
					/>
					{ ! automaticAd && (
						<>
							<TextControl
								label={ __( 'Ad ID' ) }
								value={ adId }
								onChange={ val => setAttributes( { adId: val } ) }
							/>
							<TextControl
								label={ __( 'Category ID' ) }
								value={ categoryId }
								onChange={ val => setAttributes( { categoryId: val } ) }
							/>
						</>
					) }
				</PanelBody>
			</InspectorControls>
			<Placeholder { ...blockProps } />
		</>
	);
}

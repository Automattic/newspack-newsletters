/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';

const handleSideAlignment = ( warnings, props ) => {
	if ( props.attributes.align === 'left' || props.attributes.align === 'right' ) {
		warnings.push( __( 'Side alignment', 'newspack-newsletters' ) );
	}
	return warnings;
};

const getWarnings = props => {
	let warnings = [];
	switch ( props.name ) {
		case 'core/column':
			if ( props.attributes.__nestedColumnWarning ) {
				warnings.push( __( 'Nested columns', 'newspack-newsletters' ) );
			}
			if ( props.attributes.verticalAlignment === 'center' ) {
				warnings.push( __( 'Middle alignment', 'newspack-newsletters' ) );
			}
			break;

		case 'core/image':
			warnings = handleSideAlignment( warnings, props );
			if ( props.attributes.align === 'full' ) {
				warnings.push( __( 'Full width', 'newspack-newsletters' ) );
			}
			break;

		case 'core/paragraph':
			if ( props.attributes.content.indexOf( '<img' ) >= 0 ) {
				warnings.push( __( 'Inline image', 'newspack-newsletters' ) );
			}
			if ( props.attributes.dropCap ) {
				warnings.push( __( 'Drop cap', 'newspack-newsletters' ) );
			}
			break;
	}
	return warnings;
};

const withUnsupportedFeaturesNotices = createHigherOrderComponent( BlockListBlock => {
	return props => {
		const warnings = getWarnings( props );
		return warnings.length ? (
			<div className="newspack-newsletters__editor-block">
				<div className="newspack-newsletters__editor-block__warning components-notice is-error">
					{ __(
						'These features will not be displayed correctly in an email, please remove them:',
						'newspack-newsletters'
					) }
					<ul>
						{ warnings.map( ( warning, i ) => (
							<li key={ i }>{ warning }</li>
						) ) }
					</ul>
				</div>
				<BlockListBlock { ...props } />
			</div>
		) : (
			<BlockListBlock { ...props } />
		);
	};
}, 'withInspectorControl' );

export const addBlocksValidationFilter = () => {
	addFilter(
		'editor.BlockListBlock',
		'newspack-newsletters/unsupported-features-notices',
		withUnsupportedFeaturesNotices
	);
};

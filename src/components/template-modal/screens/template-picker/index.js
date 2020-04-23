/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { Fragment, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { BlockPreview } from '@wordpress/block-editor';
import { ENTER, SPACE } from '@wordpress/keycodes';

export default ( { onInsertTemplate, templates } ) => {
	const [ selectedTemplate, setSelectedTemplate ] = useState( 1 );
	const generateBlockPreview = () => {
		return templates && templates[ selectedTemplate ]
			? parse( templates[ selectedTemplate ].content )
			: null;
	};
	const blockPreview = generateBlockPreview();

	return (
		<Fragment>
			<div className="newspack-newsletters-modal__content">
				<div className="newspack-newsletters-modal__patterns">
					<div className="block-editor-patterns">
						{ ( templates || [] ).map( ( { title, content }, index ) =>
							0 === index ? null : (
								<div
									key={ index }
									className={
										selectedTemplate === index
											? 'selected block-editor-patterns__item'
											: 'block-editor-patterns__item'
									}
									onClick={ () => setSelectedTemplate( index ) }
									onKeyDown={ event => {
										if ( ENTER === event.keyCode || SPACE === event.keyCode ) {
											event.preventDefault();
											setSelectedTemplate( index );
										}
									} }
									role="button"
									tabIndex="0"
									aria-label={ title }
								>
									<div className="block-editor-patterns__item-preview">
										<BlockPreview blocks={ parse( content ) } viewportWidth={ 568 } />
									</div>
									<div className="block-editor-patterns__item-title">{ title }</div>
								</div>
							)
						) }
					</div>
				</div>

				<div className="newspack-newsletters-modal__preview">
					{ blockPreview && blockPreview.length > 0 ? (
						<BlockPreview blocks={ blockPreview } viewportWidth={ 568 } />
					) : (
						<p>{ __( 'Select a layout to preview.', 'newspack-newsletters' ) }</p>
					) }
				</div>
			</div>
			<Button isSecondary onClick={ () => onInsertTemplate( 0 ) }>
				{ __( 'Use empty layout', 'newspack-newsletters' ) }
			</Button>
			<Button isPrimary onClick={ () => onInsertTemplate( selectedTemplate ) }>
				{ __( 'Use this layout', 'newspack-newsletters' ) }
			</Button>
		</Fragment>
	);
};

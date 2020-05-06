/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { Fragment, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { BlockPreview } from '@wordpress/block-editor';
import { ENTER, SPACE } from '@wordpress/keycodes';

/**
 * Internal dependencies
 */
import { setPreventDeduplicationForPostsInserter } from '../../../../editor/blocks/posts-inserter/utils';

export default ( { onInsertTemplate, templates } ) => {
	const [ selectedTemplate, setSelectedTemplate ] = useState( null );
	const generateBlockPreview = () => {
		return templates && templates[ selectedTemplate ]
			? parse( templates[ selectedTemplate ].content )
			: null;
	};
	const blockPreview = generateBlockPreview();

	return (
		<Fragment>
			<div className="newspack-newsletters-modal__content">
				<div className="newspack-newsletters-modal__layouts">
					<div className="newspack-newsletters-layouts">
						{ ( templates || [] ).map( ( { title, content }, index ) =>
							'' === content ? null : (
								<div
									key={ index }
									className={
										selectedTemplate === index
											? 'newspack-newsletters-layouts__item is-active'
											: 'newspack-newsletters-layouts__item'
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
									<div className="newspack-newsletters-layouts__item-preview">
										<BlockPreview
											blocks={ setPreventDeduplicationForPostsInserter( parse( content ) ) }
											viewportWidth={ 600 }
										/>
									</div>
									<div className="newspack-newsletters-layouts__item-label">{ title }</div>
								</div>
							)
						) }
					</div>
				</div>

				<div className="newspack-newsletters-modal__preview">
					{ blockPreview && blockPreview.length > 0 ? (
						<BlockPreview blocks={ blockPreview } viewportWidth={ 600 } />
					) : (
						<p>{ __( 'Select a layout to preview.', 'newspack-newsletters' ) }</p>
					) }
				</div>
			</div>
			<div className="newspack-newsletters-modal__action-buttons">
				<Button isSecondary onClick={ () => onInsertTemplate( 0 ) }>
					{ __( 'Start From Scratch', 'newspack-newsletters' ) }
				</Button>
				<span className="separator">{ __( 'or', 'newspack-newsletters' ) }</span>
				<Button
					isPrimary
					disabled={ selectedTemplate < 1 }
					onClick={ () => onInsertTemplate( selectedTemplate ) }
				>
					{ __( 'Use Selected Layout', 'newspack-newsletters' ) }
				</Button>
			</div>
		</Fragment>
	);
};

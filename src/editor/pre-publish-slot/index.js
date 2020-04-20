/**
 * WordPress dependencies
 */
import { Notice } from '@wordpress/components';
import { withSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';
import { PluginPrePublishPanel } from '@wordpress/edit-post';

const PrePublishSlot = withSelect( select => {
	const { getEditedPostAttribute } = select( 'core/editor' );
	const meta = getEditedPostAttribute( 'meta' );
	return {
		validationErrors: meta.campaignValidationErrors || [],
	};
} )( ( { validationErrors } ) => {
	if ( validationErrors.length ) {
		return (
			<ul className="newspack-newsletters__pre-publish-errors">
				{ validationErrors.map( ( message, index ) => (
					<li key={ index }>
						<Notice status="error" isDismissible={ false }>
							{ message }
						</Notice>
					</li>
				) ) }
			</ul>
		);
	}
	return (
		<Notice isDismissible={ false }>
			{ __( 'Newsletter is ready to be sent.', 'newspack-newsletters' ) }
		</Notice>
	);
} );

export default () => {
	registerPlugin( 'newspack-newsletters-pre-publish', {
		render: () => (
			<PluginPrePublishPanel>
				<PrePublishSlot />
			</PluginPrePublishPanel>
		),
		icon: null,
	} );
};

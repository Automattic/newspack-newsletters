/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Fragment } from '@wordpress/element';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import { DatePicker } from '@wordpress/components';

const AdEdit = ( { expiryDate, editPost } ) => {
	return (
		<Fragment>
			<PluginDocumentSettingPanel
				name="newsletters-ads-settings-panel"
				title={ __( 'Expiry date', 'newspack-newsletters' ) }
			>
				<DatePicker
					currentDate={ expiryDate }
					onChange={ expiry_date => editPost( { meta: { expiry_date } } ) }
				/>
			</PluginDocumentSettingPanel>
		</Fragment>
	);
};

const AdEditWithSelect = compose( [
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return { expiryDate: meta.expiry_date };
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		return { editPost };
	} ),
] )( AdEdit );

registerPlugin( 'newspack-newsletters-sidebar', {
	render: AdEditWithSelect,
	icon: null,
} );

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Fragment } from '@wordpress/element';
import { PluginDocumentSettingPanel, PluginPrePublishPanel } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import { ToggleControl, DatePicker, Notice, RangeControl } from '@wordpress/components';
import { format, isInTheFuture } from '@wordpress/date';

const AdEdit = ( { startDate, expiryDate, positionInContent, editPost } ) => {
	let noticeProps;
	if ( expiryDate ) {
		const formattedExpiryDate = format( 'M j Y', expiryDate );
		const isExpiryInTheFuture = isInTheFuture( expiryDate );
		noticeProps = {
			children: isExpiryInTheFuture
				? `${ __( 'This ad will expire on ', 'newspack-newsletters' ) } ${ formattedExpiryDate }.`
				: __(
						'The expiration date is set in the past. This ad will not be displayed.',
						'newspack-newsletters'
				  ),
			status: isExpiryInTheFuture ? 'info' : 'warning',
		};
	}

	return (
		<Fragment>
			<PluginDocumentSettingPanel
				name="newsletters-ads-settings-panel"
				title={ __( 'Ad settings', 'newspack-newsletters' ) }
			>
				<RangeControl
					label={ __( 'Approximate position (in percent)' ) }
					value={ positionInContent }
					onChange={ position_in_content => editPost( { meta: { position_in_content } } ) }
					min={ 0 }
					max={ 100 }
				/>
				<ToggleControl
					label={ __( 'Custom Start Date', 'newspack-newsletters' ) }
					checked={ !! startDate }
					onChange={ () => {
						if ( startDate ) {
							editPost( { meta: { start_date: null } } );
						} else {
							editPost( { meta: { start_date: new Date() } } );
						}
					} }
				/>
				{ startDate ? (
					<DatePicker
						currentDate={ startDate }
						onChange={ start_date => editPost( { meta: { start_date } } ) }
						isInvalidDate={ date => ! isInTheFuture( date ) }
					/>
				) : null }
				<hr />
				<ToggleControl
					label={ __( 'Expiration Date', 'newspack-newsletters' ) }
					checked={ !! expiryDate }
					onChange={ () => {
						if ( expiryDate ) {
							editPost( { meta: { expiry_date: null } } );
						} else {
							editPost( { meta: { expiry_date: startDate ? new Date( startDate ) : new Date() } } );
						}
					} }
				/>
				{ expiryDate ? (
					<DatePicker
						currentDate={ expiryDate }
						onChange={ expiry_date => editPost( { meta: { expiry_date } } ) }
						isInvalidDate={ date => {
							return startDate ? date < new Date( startDate ) : ! isInTheFuture( date );
						} }
					/>
				) : null }
			</PluginDocumentSettingPanel>
			{ noticeProps ? (
				<PluginPrePublishPanel>
					<Notice isDismissible={ false } { ...noticeProps } />
				</PluginPrePublishPanel>
			) : null }
		</Fragment>
	);
};

const AdEditWithSelect = compose( [
	withSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			startDate: meta.start_date,
			expiryDate: meta.expiry_date,
			positionInContent: meta.position_in_content,
		};
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

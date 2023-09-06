/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { useSelect, useDispatch } from '@wordpress/data';
import { Fragment } from '@wordpress/element';
import {
	PluginDocumentSettingPanel,
	PluginPrePublishPanel,
	store as editPostStore,
} from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import {
	ToggleControl,
	TextControl,
	DatePicker,
	Notice,
	RangeControl,
} from '@wordpress/components';
import { format, isInTheFuture } from '@wordpress/date';

function AdEdit() {
	const { price, startDate, expiryDate, positionInContent } = useSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			price: meta.price,
			startDate: meta.start_date,
			expiryDate: meta.expiry_date,
			positionInContent: meta.position_in_content,
		};
	} );
	const { editPost } = useDispatch( 'core/editor' );
	const { removeEditorPanel } = useDispatch( editPostStore );
	const messages = [];
	if ( expiryDate && ! isInTheFuture( expiryDate ) ) {
		messages.push(
			__(
				'The expiration date is set in the past. This ad will not be displayed.',
				'newspack-newsletters'
			)
		);
	}
	if ( startDate && startDate > expiryDate ) {
		messages.push(
			sprintf(
				// translators: %s: date.
				__(
					'The expiration date is set before the start date (%s). This ad will not be displayed.',
					'newspack-newsletters'
				),
				format( 'M j Y', startDate )
			)
		);
	}
	let defaultMessage;
	if ( startDate && expiryDate ) {
		defaultMessage = sprintf(
			// translators: %1$s: date, %2$s: date.
			__( 'This ad will be displayed between %1$s and %2$s.', 'newspack-newsletters' ),
			format( 'M j Y', startDate ),
			format( 'M j Y', expiryDate )
		);
	} else if ( startDate ) {
		defaultMessage = sprintf(
			// translators: %s: date.
			__( 'This ad will be displayed starting %s.', 'newspack-newsletters' ),
			format( 'M j Y', startDate )
		);
	} else if ( expiryDate ) {
		defaultMessage = sprintf(
			// translators: %s: date.
			__( 'This ad will be displayed until %s.', 'newspack-newsletters' ),
			format( 'M j Y', expiryDate )
		);
	}

	let noticeProps;
	if ( defaultMessage || messages.length ) {
		noticeProps = {
			children: messages.length
				? messages.map( ( message, index ) => <p key={ index }>{ message }</p> )
				: defaultMessage,
			status: messages.length ? 'warning' : 'info',
		};
	}

	// Remove the "post-status" (Summary) panel.
	removeEditorPanel( 'post-status' );

	return (
		<Fragment>
			<PluginDocumentSettingPanel
				name="newsletters-ads-settings-panel"
				title={ __( 'Ad settings', 'newspack-newsletters' ) }
			>
				<TextControl
					type="number"
					label={ __( 'Price', 'newspack-newsletters' ) }
					value={ price }
					onChange={ val => editPost( { meta: { price: val } } ) }
					min={ 0 }
					step={ 0.01 }
				/>
				<hr />
				<RangeControl
					label={ __( 'Approximate position (in percent)' ) }
					value={ positionInContent }
					onChange={ position_in_content => editPost( { meta: { position_in_content } } ) }
					min={ 0 }
					max={ 100 }
				/>
				<hr />
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
}

registerPlugin( 'newspack-newsletters-sidebar', {
	render: AdEdit,
	icon: null,
} );

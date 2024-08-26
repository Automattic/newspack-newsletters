/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Button, Notice, SelectControl, TextControl } from '@wordpress/components';
import { Icon, external } from '@wordpress/icons';

/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * Internal dependencies
 */
import { useNewsletterData } from '../../newsletter-editor/store';
import { hasValidEmail } from '../utils';

const Sender = (
	{
		errors,
		inFlight,
		senderEmail,
		senderName,
		updateMeta
	}
) => {
	const newsletterData = useNewsletterData();
	const { confirmed_email_addresses: confirmedEmails, email_settings_url: settingsUrl } = newsletterData;
	const senderEmailClasses = classnames(
		'newspack-newsletters__email-textcontrol',
		errors.newspack_newsletters_unverified_sender_domain && 'newspack-newsletters__error'
	);

	return (
		<>
			<strong className="newspack-newsletters__label">
				{ __( 'Sender', 'newspack-newsletters' ) }
			</strong>
			{
				( newsletterData?.senderEmail || newsletterData?.senderName ) && (
					<Notice status="success" isDismissible={ false }>
						{ __( 'Updated sender info fetched from ESP.', 'newspack-newsletters' ) }
					</Notice>
				)
			}
			<TextControl
				label={ __( 'Name', 'newspack-newsletters' ) }
				className="newspack-newsletters__name-textcontrol"
				value={ senderName }
				disabled={ inFlight }
				onChange={ value => updateMeta( { senderName: value } ) }
				placeholder={ __( 'The campaign’s sender name.', 'newspack-newsletters' ) }
			/>
			{ ! inFlight && ! confirmedEmails && (
				<TextControl
					label={ __( 'Email', 'newspack-newsletters' ) }
					help={ senderEmail && ! hasValidEmail( senderEmail ) ? __( 'Please enter a valid email address.', 'newspack-newsletters' ) : null }
					className={ senderEmailClasses }
					value={ senderEmail }
					type="email"
					disabled={ inFlight }
					onChange={ value => updateMeta( { senderEmail: value } ) }
					placeholder={ __( 'The campaign’s sender email.', 'newspack-newsletters' ) }
				/>
			) }
			{ Array.isArray( confirmedEmails ) && (
				<>
					{ ! inFlight && ! confirmedEmails.length && (
						<Notice status="warning" isDismissible={ false }>
							{ __( 'The sender email must be a confirmed address, but there are no confirmed addresses.', 'newspack-newsletters' ) }
						</Notice>
					) }
					{ confirmedEmails.length && (
						<SelectControl
						label={ __( 'Email', 'newspack-newsletters' ) }
						help={ __(
							'The sender email must be a confirmed address.',
							'newspack-newsletters'
						) }
						value={ senderEmail || '' }
						onChange={ value => updateMeta( { senderEmail: value } ) }
						options={ [
							{
								label: __( '-- Select a sender email --', 'newspack-newsletters' ),						value: ''
							},
						].concat(
							confirmedEmails.map( email => ( {
								label: email,
								value: email,
							} ) )
						) }
						/>
					) }
					{ settingsUrl && (
						<Button
							disabled={ inFlight }
							href={ settingsUrl }
							size="small"
							target="_blank"
							variant="secondary"
							rel="noopener noreferrer"
						>
							{ __( 'Manage', 'newspack-newsletters' ) }
							<Icon icon={ external } size={ 14 } />
						</Button>
					) }
				</>
			) }
		</>
	);
}

export default Sender;
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { Component, Fragment } from '@wordpress/element';
import { Button, Modal, Notice, SelectControl, Spinner, TextControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import './style.scss';

class Sidebar extends Component {
	state = {
		inFlight: false,
		showTestModal: false,
		testEmail: '',
		senderEmail: '',
		senderName: '',
		senderDirty: false,
	};
	sendMailchimpTest = () => {
		const { testEmail } = this.state;
		this.setState( { inFlight: true } );
		const { postId } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/test`,
			data: {
				test_email: testEmail,
			},
			method: 'POST',
		};
		apiFetch( params ).then( this.setStateFromAPIResponse );
	};
	setList = listId => {
		this.setState( { inFlight: true } );
		const { postId } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/list/${ listId }`,
			method: 'POST',
		};
		apiFetch( params ).then( this.setStateFromAPIResponse );
	};
	updateSender = ( senderName, senderEmail ) => {
		this.setState( { inFlight: true } );
		const { postId } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/settings`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		};
		apiFetch( params ).then( this.setStateFromAPIResponse );
	};
	setStateFromAPIResponse = result => {
		this.props.editPost( getEditPostPayload( result ) );

		this.setState( {
			inFlight: false,
			senderName: result.campaign.settings.from_name,
			senderEmail: result.campaign.settings.reply_to,
			senderDirty: false,
		} );
	};

	/**
	 * Render
	 */
	render() {
		const { campaign, lists, editPost, title } = this.props;
		const { inFlight, showTestModal, testEmail, senderName, senderEmail, senderDirty } = this.state;
		if ( ! campaign ) {
			return (
				<div className="newspack-newsletters__loading-data">
					{ __( 'Retrieving Mailchimp data...', 'newspack-newsletters' ) }
					<Spinner key="spinner" />
				</div>
			);
		}
		const { recipients, status } = campaign || {};
		const { list_id } = recipients || {};
		if ( ! status ) {
			return (
				<Notice status="info" isDismissible={ false }>
					{ __( 'Publish to sync to Mailchimp.', 'newspack-newsletters' ) }
				</Notice>
			);
		}
		if ( 'sent' === status || 'sending' === status ) {
			return (
				<Notice status="success" isDismissible={ false }>
					{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
				</Notice>
			);
		}
		return (
			<Fragment>
				<strong>{ __( 'From', 'newspack-newsletters' ) }</strong>
				<TextControl
					label={ __( 'Name', 'newspack-newsletters' ) }
					className="newspack-newsletters__name-textcontrol"
					value={ senderName }
					disabled={ inFlight }
					onChange={ value => this.setState( { senderName: value, senderDirty: true } ) }
				/>
				<TextControl
					label={ __( 'Email', 'newspack-newsletters' ) }
					className="newspack-newsletters__email-textcontrol"
					value={ senderEmail }
					type="email"
					disabled={ inFlight }
					onChange={ value => this.setState( { senderEmail: value, senderDirty: true } ) }
				/>
				{ senderDirty && (
					<Button
						isLink
						onClick={ () => this.updateSender( senderName, senderEmail ) }
						disabled={ inFlight }
					>
						{ __( 'Update Sender', 'newspack-newsletters' ) }
					</Button>
				) }
				<hr />
				<SelectControl
					label={ __( 'To', 'newspack-newsletters' ) }
					className="newspack-newsletters__to-selectcontrol"
					value={ list_id }
					options={ [
						{
							value: null,
							label: __( '-- Select a list --', 'newspack-newsletters' ),
						},
						...lists.map( ( { id, name } ) => ( {
							value: id,
							label: name,
						} ) ),
					] }
					onChange={ value => this.setList( value ) }
					disabled={ inFlight }
				/>
				<hr />
				<TextControl
					label={ __( 'Subject', 'newspack-newsletters' ) }
					className="newspack-newsletters__subject-textcontrol"
					value={ title }
					disabled={ inFlight }
					onChange={ value => editPost( { title: value } ) }
				/>
				<hr />
				<Button
					isPrimary
					onClick={ () => this.setState( { showTestModal: true } ) }
					disabled={ inFlight }
				>
					{ __( 'Send Test', 'newspack-newsletters' ) }
				</Button>
				{ showTestModal && (
					<Modal
						title={ __( 'Send Test Email', 'newspack-newsletters' ) }
						onRequestClose={ () => this.setState( { showTestModal: false } ) }
						className="newspack-newsletters__send-test"
					>
						<TextControl
							label={ __( 'Send to this email', 'newspack-newsletters' ) }
							value={ testEmail }
							type="email"
							onChange={ value => this.setState( { testEmail: value } ) }
						/>
						<Button
							isPrimary
							onClick={ () =>
								this.setState( { showTestModal: false }, () => this.sendMailchimpTest() )
							}
						>
							{ __( 'Send Test', 'newspack-newsletters' ) }
						</Button>
						<Button isTertiary onClick={ () => this.setState( { showTestModal: false } ) }>
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
					</Modal>
				) }
			</Fragment>
		);
	}
}

export default compose( [
	withSelect( select => {
		const { getEditedPostAttribute, getCurrentPostId } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			title: getEditedPostAttribute( 'title' ),
			campaign: meta.campaign,
			lists: meta.lists ? meta.lists.lists : [],
			postId: getCurrentPostId(),
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		return { editPost };
	} ),
] )( Sidebar );

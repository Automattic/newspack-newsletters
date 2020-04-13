/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch, subscribe } from '@wordpress/data';
import { Component, Fragment } from '@wordpress/element';
import {
	Button,
	ExternalLink,
	Modal,
	Notice,
	SelectControl,
	Spinner,
	TextControl,
} from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import './style.scss';

class Sidebar extends Component {
	state = {
		campaign: {},
		lists: [],
		hasResults: false,
		inFlight: false,
		isPublishingOrSaving: false,
		showTestModal: false,
		testEmail: '',
		senderEmail: '',
		senderName: '',
		senderDirty: false,
	};
	componentDidMount = () => {
		this.retrieveMailchimp();
		subscribe( () => {
			const { isPublishingPost, isSavingPost } = this.props;
			const { isPublishingOrSaving } = this.state;
			if ( ( isPublishingPost() || isSavingPost() ) && ! isPublishingOrSaving ) {
				this.setState( { isPublishingOrSaving: true } );
			}
			if ( ! isPublishingPost() && ! isSavingPost() && isPublishingOrSaving ) {
				this.setState( { isPublishingOrSaving: false }, () => {
					this.retrieveMailchimp();
				} );
			}
		} );
	};
	retrieveMailchimp = () => {
		const { postId } = this.props;
		apiFetch( { path: `/newspack-newsletters/v1/mailchimp/${ postId }` } ).then( result =>
			this.setStateFromAPIResponse( result )
		);
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
		apiFetch( params ).then( result => this.setStateFromAPIResponse( result ) );
	};
	setList = listId => {
		this.setState( { inFlight: true } );
		const { postId } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/list/${ listId }`,
			method: 'POST',
		};
		apiFetch( params ).then( result => this.setStateFromAPIResponse( result ) );
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
		apiFetch( params ).then( result => this.setStateFromAPIResponse( result ) );
	};
	setStateFromAPIResponse = result => {
		this.props.editPost( getEditPostPayload( result.campaign ) );

		this.setState( {
			campaign: result.campaign,
			lists: result.lists.lists,
			hasResults: true,
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
		const {
			campaign,
			hasResults,
			inFlight,
			lists,
			showTestModal,
			testEmail,
			senderName,
			senderEmail,
			senderDirty,
		} = this.state;
		if ( ! hasResults ) {
			return [
				__( 'Retrieving Mailchimp data', 'newspack-newsletters' ),
				<Spinner key="spinner" />,
			];
		}
		const { recipients, status, long_archive_url } = campaign || {};
		const { list_id } = recipients || {};
		if ( ! status ) {
			return (
				<Notice status="info" isDismissible={ false }>
					<p>{ __( 'Publish to sync to Mailchimp', 'newspack-newsletters' ) }</p>
				</Notice>
			);
		}
		if ( 'sent' === status || 'sending' === status ) {
			return (
				<Notice status="info" isDismissible={ false }>
					<p>{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }</p>
				</Notice>
			);
		}
		return (
			<Fragment>
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
					>
						<TextControl
							label={ __( 'Send to this email', 'newspack-newsletters' ) }
							value={ testEmail }
							onChange={ value => this.setState( { testEmail: value } ) }
						/>
						<Button
							isPrimary
							onClick={ () =>
								this.setState( { showTestModal: false }, () => this.sendMailchimpTest() )
							}
						>
							{ __( 'Send', 'newspack-newsletters' ) }
						</Button>
					</Modal>
				) }

				<SelectControl
					label={ __( 'Mailchimp Lists', 'newspack-newsletters' ) }
					value={ list_id }
					options={ [
						{
							value: null,
							label: __( '-- Select A List --', 'newspack-newsletters' ),
						},
						...lists.map( ( { id, name } ) => ( {
							value: id,
							label: name,
						} ) ),
					] }
					onChange={ value => this.setList( value ) }
					disabled={ inFlight }
				/>
				<TextControl
					label={ __( 'Sender name', 'newspack-newsletters' ) }
					value={ senderName }
					disabled={ inFlight }
					onChange={ value => this.setState( { senderName: value, senderDirty: true } ) }
				/>
				<TextControl
					label={ __( 'Sender email', 'newspack-newsletters' ) }
					value={ senderEmail }
					disabled={ inFlight }
					onChange={ value => this.setState( { senderEmail: value, senderDirty: true } ) }
				/>
				{ senderDirty && (
					<Button
						isPrimary
						onClick={ () => this.updateSender( senderName, senderEmail ) }
						disabled={ inFlight }
					>
						{ __( 'Update Sender', 'newspack-newsletters' ) }
					</Button>
				) }
				{ long_archive_url && (
					<div>
						<ExternalLink href={ long_archive_url }>
							{ __( 'View on Mailchimp', 'newspack-newsletters' ) }
						</ExternalLink>
					</div>
				) }
			</Fragment>
		);
	}
}

export default compose( [
	withSelect( select => {
		const { getCurrentPostId, isPublishingPost, isSavingPost } = select( 'core/editor' );
		return { postId: getCurrentPostId(), isPublishingPost, isSavingPost };
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		return { editPost };
	} ),
] )( Sidebar );

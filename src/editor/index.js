/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { withSelect, withDispatch, subscribe } from '@wordpress/data';
import { compose } from '@wordpress/compose';
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
import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import './style.scss';

/**
 * Internal dependencies
 */
import TemplateModal from '../components/template-modal';

class NewsletterSidebar extends Component {
	state = {
		campaign: {},
		lists: [],
		hasResults: false,
		inFlight: false,
		isPublishingOrSaving: false,
		showTestModal: false,
		testEmail: '',
		selectedTemplate: 0,
		senderEmail: '',
		senderName: '',
		templates:
			window && window.newspack_newsletters_data && window.newspack_newsletters_data.templates,
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
	sendMailchimpCampaign = () => {
		const { senderEmail, senderName } = this.state;
		this.setState( { inFlight: true } );
		const { postId } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/send`,
			data: {
				sender_email: senderEmail,
				sender_name: senderName,
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
	setStateFromAPIResponse = result => {
		this.setState( {
			campaign: result.campaign,
			lists: result.lists.lists,
			hasResults: true,
			inFlight: false,
		} );
	};
	onSelectTemplate = selectedTemplate => this.setState( { selectedTemplate } );
	onInsertTemplate = selectedTemplate => {
		const { templates } = this.state;
		const template = templates[ selectedTemplate ];
		const { getBlocks, insertBlocks, replaceBlocks } = this.props;
		const clientIds = getBlocks().map( ( { clientId } ) => clientId );
		this.setState( { modalDismissed: true }, () =>
			clientIds && clientIds.length
				? replaceBlocks( clientIds, parse( template.content ) )
				: insertBlocks( parse( template.content ) )
		);
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
			modalDismissed,
			selectedTemplate,
			templates,
		} = this.state;
		const { getCurrentPostAttribute } = this.props;
		if ( 'auto-draft' === getCurrentPostAttribute( 'status' ) && ! modalDismissed ) {
			return (
				<TemplateModal
					templates={ templates }
					onInsertTemplate={ this.onInsertTemplate }
					onSelectTemplate={ this.onSelectTemplate }
					closeModal={ () => this.setState( { modalDismissed: true } ) }
					selectedTemplate={ selectedTemplate }
				/>
			);
		}
		if ( ! hasResults ) {
			return [ __( 'Loading Mailchimp data', 'newspack-newsletters' ), <Spinner key="spinner" /> ];
		}
		const { recipients, status, long_archive_url } = campaign || {};
		const { list_id } = recipients || {};
		if ( ! status ) {
			return (
				<Notice status="info" isDismissible={ false }>
					{ __( 'Publish to sync to Mailchimp', 'newspack-newsletters' ) }
				</Notice>
			);
		}
		if ( 'sent' === status || 'sending' === status ) {
			return (
				<Notice status="info" isDismissible={ false }>
					{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
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
					label={ __( 'Mailchimp Lists' ) }
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
					onChange={ value => this.setState( { senderName: value } ) }
				/>
				<TextControl
					label={ __( 'Sender email', 'newspack-newsletters' ) }
					value={ senderEmail }
					onChange={ value => this.setState( { senderEmail: value } ) }
				/>
				{ list_id && (
					<div>
						<Button isPrimary onClick={ () => this.sendMailchimpCampaign() } disabled={ inFlight }>
							{ __( 'Send Campaign', 'newspack-newsletters' ) }
						</Button>
					</div>
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

const NewsletterSidebarWithSelect = compose( [
	withSelect( select => {
		const { getCurrentPostId, getCurrentPostAttribute, isPublishingPost, isSavingPost } = select(
			'core/editor'
		);
		const { getBlocks } = select( 'core/block-editor' );
		return {
			postId: getCurrentPostId(),
			getBlocks,
			getCurrentPostAttribute,
			isPublishingPost,
			isSavingPost,
		};
	} ),
	withDispatch( dispatch => {
		const { insertBlocks, replaceBlocks } = dispatch( 'core/block-editor' );
		return { insertBlocks, replaceBlocks };
	} ),
] )( NewsletterSidebar );

const PluginDocumentSettingPanelDemo = () => (
	<PluginDocumentSettingPanel
		name="newsletters-settings-panel"
		title={ __( ' Newsletter Settings' ) }
	>
		<NewsletterSidebarWithSelect />
	</PluginDocumentSettingPanel>
);
registerPlugin( 'newspack-newsletters', {
	render: PluginDocumentSettingPanelDemo,
	icon: null,
} );

/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { withSelect, withDispatch, subscribe } from '@wordpress/data';
import { compose } from '@wordpress/compose';
import { Component, Fragment, useState } from '@wordpress/element';
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
		senderEmail: '',
		senderName: '',
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
		} = this.state;
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
		const { getCurrentPostId, isPublishingPost, isSavingPost } = select( 'core/editor' );
		return {
			postId: getCurrentPostId(),
			isPublishingPost,
			isSavingPost,
		};
	} ),
] )( NewsletterSidebar );

const NewsletterEdit = props => {
	const { isReady } = props;
	const templates =
		window && window.newspack_newsletters_data && window.newspack_newsletters_data.templates;

	const [ selectedTemplate, setSelectedTemplate ] = useState( 0 );
	const [ insertedTemplate, setInserted ] = useState();

	const handleTemplateInsertion = templateIndex => {
		const { onMetaFieldChange } = props;
		const template = templates[ templateIndex ];
		const { getBlocks, insertBlocks, replaceBlocks } = props;
		const clientIds = getBlocks().map( ( { clientId } ) => clientId );
		if ( clientIds && clientIds.length ) {
			replaceBlocks( clientIds, parse( template.content ) );
		} else {
			insertBlocks( parse( template.content ) );
		}
		onMetaFieldChange( 'is_ready', true );
		setInserted( templateIndex );
	};

	return isReady || ! templates || insertedTemplate ? (
		<PluginDocumentSettingPanel
			name="newsletters-settings-panel"
			title={ __( ' Newsletter Settings' ) }
		>
			<NewsletterSidebarWithSelect />
		</PluginDocumentSettingPanel>
	) : (
		<TemplateModal
			templates={ templates }
			onInsertTemplate={ handleTemplateInsertion }
			onSelectTemplate={ setSelectedTemplate }
			selectedTemplate={ selectedTemplate }
		/>
	);
};

const NewsletterEditWithSelect = compose( [
	withSelect( select => {
		const {
			getCurrentPostId,
			getCurrentPostAttribute,
			getEditedPostAttribute,
			isPublishingPost,
			isSavingPost,
		} = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		const { is_ready: isReady } = meta || {};
		const { getBlocks } = select( 'core/block-editor' );
		return {
			postId: getCurrentPostId(),
			getBlocks,
			getCurrentPostAttribute,
			isPublishingPost,
			isSavingPost,
			isReady,
		};
	} ),
	withDispatch( dispatch => {
		const { insertBlocks, replaceBlocks } = dispatch( 'core/block-editor' );
		const onMetaFieldChange = ( key, value ) => {
			dispatch( 'core/editor' ).editPost( { meta: { [ key ]: value } } );
		};
		return { insertBlocks, onMetaFieldChange, replaceBlocks };
	} ),
] )( NewsletterEdit );

registerPlugin( 'newspack-newsletters', {
	render: NewsletterEditWithSelect,
	icon: null,
} );

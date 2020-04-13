/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { unregisterBlockStyle } from '@wordpress/blocks';
import {
	Button,
	ExternalLink,
	Modal,
	Notice,
	SelectControl,
	Spinner,
	TextControl,
} from '@wordpress/components';
import { compose } from '@wordpress/compose';
import { withSelect, subscribe } from '@wordpress/data';
import domReady from '@wordpress/dom-ready';
import { PluginDocumentSettingPanel } from '@wordpress/edit-post';
import { Component, Fragment } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';

/**
 * Internal dependencies
 */
import './style.scss';
import { addBlocksValidationFilter } from './blocks-validation/blocks-filters';
import { NestedColumnsDetection } from './blocks-validation/nested-columns-detection';

addBlocksValidationFilter();

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
					<p>{ __( 'Publish to sync to Mailchimp' ) }</p>
				</Notice>
			);
		}
		if ( 'sent' === status || 'sending' === status ) {
			return (
				<Notice status="info" isDismissible={ false }>
					<p>{ __( 'Campaign has been sent.' ) }</p>
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
		return { postId: getCurrentPostId(), isPublishingPost, isSavingPost };
	} ),
] )( NewsletterSidebar );

const PluginDocumentSettingPanelDemo = () => (
	<Fragment>
		<NestedColumnsDetection />
		<PluginDocumentSettingPanel
			name="newsletters-settings-panel"
			title={ __( ' Newsletter Settings' ) }
		>
			<NewsletterSidebarWithSelect />
		</PluginDocumentSettingPanel>
	</Fragment>
);
registerPlugin( 'newspack-newsletters', {
	render: PluginDocumentSettingPanelDemo,
	icon: null,
} );

/* Unregister core block styles that are unsupported in emails */
domReady( () => {
	unregisterBlockStyle( 'core/separator', 'dots' );
	unregisterBlockStyle( 'core/social-links', 'logos-only' );
	unregisterBlockStyle( 'core/social-links', 'pill-shape' );
} );

addFilter( 'blocks.registerBlockType', 'newspack-newsletters/core-blocks', ( settings, name ) => {
	/* Remove left/right alignment options wherever possible */
	if (
		'core/paragraph' === name ||
		'core/social-links' === name ||
		'core/buttons' === name ||
		'core/columns' === name
	) {
		settings.supports = { ...settings.supports, align: [] };
	}
	return settings;
} );

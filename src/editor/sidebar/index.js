/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { Component, Fragment } from '@wordpress/element';
import {
	Button,
	Modal,
	Notice,
	SelectControl,
	Spinner,
	TextControl,
	ExternalLink,
} from '@wordpress/components';

/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import withAPIReponseHandling from '../with-api-reponse-handling';
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
	componentDidUpdate( prevProps ) {
		if ( ! prevProps.campaign && this.props.campaign ) {
			this.setState( {
				senderName: this.props.campaign.settings.from_name,
				senderEmail: this.props.campaign.settings.reply_to,
			} );
		}
	}
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

		this.props
			.fetchAPIData( params, {
				successMessage: __( 'Test email has been sent.', 'newspack-newsletters' ),
			} )
			.then( this.setStateFromAPIResponse );
	};
	setList = listId => {
		this.setState( { inFlight: true } );
		const { postId, fetchAPIData } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/list/${ listId }`,
			method: 'POST',
		};
		fetchAPIData( params ).then( this.setStateFromAPIResponse );
	};
	setInterest = interestId => {
		this.setState( { inFlight: true } );
		const { postId, fetchAPIData } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/interest/${ interestId }`,
			method: 'POST',
		};
		fetchAPIData( params ).then( this.setStateFromAPIResponse );
	};
	updateSender = ( senderName, senderEmail ) => {
		this.setState( { inFlight: true } );
		const { postId, fetchAPIData } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/settings`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		};
		fetchAPIData( params ).then( this.setStateFromAPIResponse );
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

	interestCategories = () => {
		const { campaign, inFlight, interestCategories } = this.state;
		if (
			! interestCategories ||
			! interestCategories.categories ||
			! interestCategories.categories.length
		) {
			return;
		}
		const options = interestCategories.categories.reduce( ( accumulator, item ) => {
			const { title, interests, id } = item;
			accumulator.push( {
				label: title,
				disabled: true,
			} );
			if ( interests && interests.interests && interests.interests.length ) {
				interests.interests.forEach( interest => {
					const isDisabled = parseInt( interest.subscriber_count ) === 0;
					accumulator.push( {
						label:
							'- ' +
							interest.name +
							( isDisabled ? __( ' (no subscribers)', 'newspack-newsletters' ) : '' ),
						value: 'interests-' + id + ':' + interest.id,
						disabled: isDisabled,
					} );
				} );
			}
			return accumulator;
		}, [] );
		const field = get( campaign, 'recipients.segment_opts.conditions.[0].field' );
		const interest_id = get( campaign, 'recipients.segment_opts.conditions.[0].value.[0]' );
		const interestValue = field && interest_id ? field + ':' + interest_id : 0;
		return (
			<SelectControl
				label={ __( 'Groups', 'newspack-newsletters' ) }
				value={ interestValue }
				options={ [
					{
						label: __( '-- Select a group --', 'newspack-newsletters' ),
						value: 'no_interests',
					},
					...options,
				] }
				onChange={ value => this.setInterest( value ) }
				disabled={ inFlight }
			/>
		);
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
		const { web_id: listWebId } = list_id && lists.find( ( { id } ) => list_id === id );
		return (
			<Fragment>
				<TextControl
					label={ __( 'Subject', 'newspack-newsletters' ) }
					className="newspack-newsletters__subject-textcontrol"
					value={ title }
					disabled={ inFlight }
					onChange={ value => editPost( { title: value } ) }
				/>
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
				{ listWebId && (
					<p>
						<ExternalLink
							href={ `https://us7.admin.mailchimp.com/lists/members/?id=${ listWebId }` }
						>
							{ __( 'Manage list', 'newspack-newsletters' ) }
						</ExternalLink>
					</p>
				) }
				{ this.interestCategories() }
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
				<Button
					isSecondary
					onClick={ () => this.setState( { showTestModal: true } ) }
					disabled={ inFlight }
				>
					{ __( 'Send a Test Email', 'newspack-newsletters' ) }
				</Button>
				{ showTestModal && (
					<Modal
						title={ __( 'Send a Test Email', 'newspack-newsletters' ) }
						onRequestClose={ () => this.setState( { showTestModal: false } ) }
						className="newspack-newsletters__send-test"
					>
						<TextControl
							label={ __( 'Send a test to', 'newspack-newsletters' ) }
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
						<Button isSecondary onClick={ () => this.setState( { showTestModal: false } ) }>
							{ __( 'Cancel', 'newspack-newsletters' ) }
						</Button>
					</Modal>
				) }
			</Fragment>
		);
	}
}

export default compose( [
	withAPIReponseHandling(),
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

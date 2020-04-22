/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { compose } from '@wordpress/compose';
import { withSelect, withDispatch } from '@wordpress/data';
import { Component, Fragment } from '@wordpress/element';
import {
	Button,
	ExternalLink,
	Notice,
	SelectControl,
	Spinner,
	TextControl,
} from '@wordpress/components';

/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * Internal dependencies
 */
import { getEditPostPayload } from '../utils';
import withApiHandler from '../../components/with-api-handler';
import './style.scss';

class Sidebar extends Component {
	state = {
		senderEmail: '',
		senderName: '',
		senderDirty: false,
	};
	setList = listId => {
		const { apiFetchWithErrorHandling, postId } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/list/${ listId }`,
			method: 'POST',
		};
		apiFetchWithErrorHandling( params ).then( this.setStateFromAPIResponse );
	};
	setInterest = interestId => {
		const { apiFetchWithErrorHandling, postId } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/interest/${ interestId }`,
			method: 'POST',
		};
		apiFetchWithErrorHandling( params ).then( result => this.setStateFromAPIResponse( result ) );
	};
	updateSender = ( senderName, senderEmail ) => {
		const { apiFetchWithErrorHandling, postId } = this.props;
		const params = {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/settings`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		};
		apiFetchWithErrorHandling( params ).then( this.setStateFromAPIResponse );
	};
	setStateFromAPIResponse = result => {
		this.props.editPost( getEditPostPayload( result ) );

		this.setState( {
			senderName: result.campaign.settings.from_name,
			senderEmail: result.campaign.settings.reply_to,
			senderDirty: false,
		} );
	};

	interestCategories = () => {
		const { campaign, inFlight, interestCategories } = this.props;
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
		const { campaign, inFlight, lists, editPost, title } = this.props;
		const { senderName, senderEmail, senderDirty } = this.state;
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
						<ExternalLink href={ `https://admin.mailchimp.com/lists/members/?id=${ listWebId }` }>
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
			</Fragment>
		);
	}
}

export default compose( [
	withApiHandler(),
	withSelect( select => {
		const { getEditedPostAttribute, getCurrentPostId } = select( 'core/editor' );
		const meta = getEditedPostAttribute( 'meta' );
		return {
			title: getEditedPostAttribute( 'title' ),
			campaign: meta.campaign,
			interestCategories: meta.interestCategories,
			lists: meta.lists ? meta.lists.lists : [],
			postId: getCurrentPostId(),
		};
	} ),
	withDispatch( dispatch => {
		const { editPost } = dispatch( 'core/editor' );
		return { editPost };
	} ),
] )( Sidebar );

/**
 * External dependencies
 */
import { get } from 'lodash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment, useEffect } from '@wordpress/element';
import { ExternalLink, SelectControl, Spinner, Notice } from '@wordpress/components';

const ProviderSidebar = ( {
	renderSubject,
	renderFrom,
	inFlight,
	newsletterData,
	apiFetch,
	postId,
	updateMeta,
} ) => {
	const campaign = newsletterData.campaign;
	const interestCategories = newsletterData.interest_categories;
	const lists = newsletterData.lists ? newsletterData.lists.lists : [];

	const setList = listId =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/list/${ listId }`,
			method: 'POST',
		} );

	const setInterest = interestId =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/interest/${ interestId }`,
			method: 'POST',
		} );

	const setSender = ( { senderName, senderEmail } ) =>
		apiFetch( {
			path: `/newspack-newsletters/v1/mailchimp/${ postId }/settings`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		} );

	useEffect(() => {
		if ( campaign && campaign.settings ) {
			updateMeta( {
				senderName: campaign.settings.from_name,
				senderEmail: campaign.settings.reply_to,
			} );
		}
	}, [ campaign ]);

	const renderInterestCategories = () => {
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
				onChange={ setInterest }
				disabled={ inFlight }
			/>
		);
	};

	if ( ! campaign ) {
		return (
			<div className="newspack-newsletters__loading-data">
				{ __( 'Retrieving Mailchimp data...', 'newspack-newsletters' ) }
				<Spinner />
			</div>
		);
	}

	if ( 'sent' === status || 'sending' === status ) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
		);
	}

	const { status } = campaign || {};
	const { list_id } = campaign.recipients || {};
	const { web_id: listWebId } = list_id && lists.find( ( { id } ) => list_id === id );

	return (
		<Fragment>
			{ renderSubject() }

			<SelectControl
				label={ __( 'To', 'newspack-newsletters' ) }
				className="newspack-newsletters__to-selectcontrol"
				value={ list_id }
				options={ [
					{
						value: null,
						label: __( '-- Select an audience --', 'newspack-newsletters' ),
					},
					...lists.map( ( { id, name } ) => ( {
						value: id,
						label: name,
					} ) ),
				] }
				onChange={ setList }
				disabled={ inFlight }
			/>
			{ listWebId && (
				<p>
					<ExternalLink href={ `https://admin.mailchimp.com/lists/members/?id=${ listWebId }` }>
						{ __( 'Manage audience', 'newspack-newsletters' ) }
					</ExternalLink>
				</p>
			) }
			{ renderInterestCategories() }

			{ renderFrom( { handleSenderUpdate: setSender } ) }
		</Fragment>
	);
};

export default ProviderSidebar;

import { once } from 'lodash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Fragment, useEffect, useState } from '@wordpress/element';
import { BaseControl, CheckboxControl, Spinner, Notice, Button } from '@wordpress/components';

const ProviderSidebar = ( {
	renderSubject,
	renderFrom,
	renderPreviewText,
	inFlight,
	newsletterData,
	apiFetch,
	postId,
	updateMeta,
} ) => {
	const [ authURL, setAuthURL ] = useState( '' );
	const [ validConnection, setValidConnection ] = useState( undefined );

	const campaign = newsletterData.campaign;
	const lists = newsletterData.lists || [];

	const verifyConnection = () => {
		if ( validConnection ) return;
		setValidConnection( undefined );
		apiFetch( {
			path: '/newspack-newsletters/v1/constant_contact/verify_connection',
			method: 'GET',
		} )
			.then( res => {
				setAuthURL( res.auth_url );
				setValidConnection( res.valid );
			} )
			.catch( () => {
				setValidConnection( false );
			} );
	};

	const setList = ( listId, value ) => {
		const method = value ? 'PUT' : 'DELETE';
		apiFetch( {
			path: `/newspack-newsletters/v1/constant_contact/${ postId }/list/${ listId }`,
			method,
		} );
	};

	const setSender = ( { senderName, senderEmail } ) =>
		apiFetch( {
			path: `/newspack-newsletters/v1/constant_contact/${ postId }/sender`,
			data: {
				from_name: senderName,
				reply_to: senderEmail,
			},
			method: 'POST',
		} );

	useEffect(() => {
		verifyConnection();
	}, [ postId ]);

	useEffect(() => {
		if ( campaign ) {
			updateMeta( {
				senderName: campaign.activity.from_name,
				senderEmail: campaign.activity.from_email,
			} );
		}
	}, [ campaign ]);

	if ( undefined === validConnection ) {
		return (
			<div className="newspack-newsletters__loading-data">
				{ __( 'Checking Constant Contact connection status...', 'newspack-newsletters' ) }
				<Spinner />
			</div>
		);
	}

	if ( ! validConnection ) {
		return (
			<Fragment>
				<p>
					{ __(
						'You must connect with your Constant Contact account before publishing your newsletter.',
						'newspack-newsletters'
					) }
				</p>
				<Button
					isPrimary
					onClick={ () => {
						const authWindow = window.open( authURL, 'ccOAuth', 'width=500,height=600' );
						authWindow.opener = { verify: once( verifyConnection ) };
					} }
				>
					{ __( 'Authenticate with Constant Contact', 'newspack-newsletter' ) }
				</Button>
			</Fragment>
		);
	}

	if ( ! campaign ) {
		return (
			<div className="newspack-newsletters__loading-data">
				{ __( 'Retrieving Constant Contact data...', 'newspack-newsletters' ) }
				<Spinner />
			</div>
		);
	}

	const { current_status: status } = campaign || {};
	if ( 'DRAFT' !== status ) {
		return (
			<Notice status="success" isDismissible={ false }>
				{ __( 'Campaign has been sent.', 'newspack-newsletters' ) }
			</Notice>
		);
	}

	return (
		<Fragment>
			{ renderSubject() }
			<BaseControl
				id="newspack-newsletters-constant_contact-lists"
				label={ __( 'Lists', 'newspack-newsletters' ) }
			>
				{ lists.map( ( { list_id: id, name } ) => (
					<CheckboxControl
						key={ id }
						label={ name }
						value={ id }
						checked={ campaign?.activity?.contact_list_ids?.some( listId => listId === id ) }
						onChange={ value => setList( id, value ) }
						disabled={ inFlight }
					/>
				) ) }
			</BaseControl>
			{ renderFrom( { handleSenderUpdate: setSender } ) }
			{ renderPreviewText() }
		</Fragment>
	);
};

export default ProviderSidebar;

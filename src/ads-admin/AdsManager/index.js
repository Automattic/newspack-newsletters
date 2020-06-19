/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { Card, Button, FormattedHeader, ActionCard } from 'newspack-components';
import classnames from 'classnames';

/**
 * Internal dependencies
 */
import { AD_CPT } from '../consts';
import './style.scss';

const AdsManager = () => {
	const [ allAds, setAllAds ] = useState( [] );
	useEffect(() => {
		apiFetch( { path: `/wp/v2/${ AD_CPT }?status=publish,future,draft` } ).then( setAllAds );
	}, []);

	return (
		<Card>
			<FormattedHeader headerText={ __( 'All ads', 'newspack-newsletters' ) } />

			<div>
				{ allAds.map( adPost => {
					const title = adPost.title.rendered;
					return (
						<ActionCard
							className={ classnames(
								adPost.status === 'publish'
									? 'newspack-card__is-primary'
									: 'newspack-card__is-secondary'
							) }
							key={ adPost.id }
							title={ title.length ? title : __( '(no title)', 'newspack' ) }
							actionText={
								<a href={ `/wp-admin/post.php?post=${ adPost.id }&action=edit` }>edit</a>
							}
						/>
					);
				} ) }
			</div>

			<Button isSecondary href={ `/wp-admin/post-new.php?post_type=${ AD_CPT }` }>
				{ __( 'Create new ad', 'newspack-newsletters' ) }
			</Button>
		</Card>
	);
};

export default AdsManager;

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getServiceProvider } from '../../service-providers';
import { useNewsletterData } from '../../newsletter-editor/store';

export default function CampaignLink() {
	const newsletterData = useNewsletterData();
	if ( ! newsletterData.link ) {
		return null;
	}
	return (
		<Button
			variant="secondary"
			href={ newsletterData.link }
			target="_blank"
			rel="noopener noreferrer"
		>
			{ sprintf(
					// translators: %s: service provider name.
					__('View Campaign in %s', 'newspack-newsletters'),
					getServiceProvider().displayName
			) }
		</Button>
	);
}

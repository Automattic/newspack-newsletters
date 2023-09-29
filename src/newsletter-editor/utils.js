/**
 * Internal dependencies
 */
import { getServiceProvider } from '../service-providers';

export const getEditPostPayload = newsletterData => {
	return {
		meta: {
			newsletterData,
		},
	};
};

export const validateNewsletter = newsletterData => {
	const { validateNewsletter: validate } = getServiceProvider();
	if ( ! validate ) {
		return [];
	}
	return validate( newsletterData );
};

/**
 * Test if a string contains valid email addresses.
 *
 * @param {string} string String to test.
 * @return {boolean} True if it contains a valid email string.
 */
export const hasValidEmail = string => /\S+@\S+/.test( string );
